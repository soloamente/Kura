/**
 * Explore API: discover people and collections by follower count.
 * Used by the /explore page to show "People with more followers" and
 * "Collections with more followers".
 */

import { db } from "@Kura/db";
import { user } from "@Kura/db/schema/auth";
import {
	bookmark,
	collection,
	collectionFollow,
	userFollow,
} from "@Kura/db/schema/bookmarks";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { authMiddleware } from "./middleware/auth";
import { getActiveUser } from "./middleware/auth-guards";

const EXPLORE_LIMIT = 50;

export const exploreRouter = new Elysia({ prefix: "/explore" })
	.use(authMiddleware)

	// ─── GET people (users with most followers) ───────────────────────────────
	.get("/people", async ({ user: me, set }) => {
		// Require auth so we can attach isFollowing for the current user
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		// Subquery: follower count per user (followingId = the user being followed)
		const followerCounts = await db
			.select({
				userId: userFollow.followingId,
				followerCount: sql<number>`count(*)::int`.as("follower_count"),
			})
			.from(userFollow)
			.groupBy(userFollow.followingId);

		const countMap = new Map(
			followerCounts.map((r) => [r.userId, r.followerCount]),
		);

		// Users that have a username (discoverable), active, not banned
		const users = await db.query.user.findMany({
			where: and(isNotNull(user.username), eq(user.status, "active")),
			columns: {
				id: true,
				name: true,
				username: true,
				image: true,
			},
		});

		// Sort by follower count desc, then take top EXPLORE_LIMIT
		const withCount = users
			.map((u) => ({
				...u,
				followerCount: countMap.get(u.id) ?? 0,
			}))
			.filter((u) => u.followerCount > 0)
			.sort((a, b) => b.followerCount - a.followerCount)
			.slice(0, EXPLORE_LIMIT);

		// Attach isFollowing for current user
		const result = await Promise.all(
			withCount.map(async (u) => {
				let isFollowing = false;
				if (u.id !== activeUser.id) {
					const follow = await db.query.userFollow.findFirst({
						where: and(
							eq(userFollow.followerId, activeUser.id),
							eq(userFollow.followingId, u.id),
						),
					});
					isFollowing = !!follow;
				}
				return { ...u, isFollowing };
			}),
		);

		return result;
	})

	// ─── GET collections (public collections with most followers) ─────────────
	.get("/collections", async ({ user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		// Follower count per collection
		const followerCounts = await db
			.select({
				collectionId: collectionFollow.collectionId,
				followerCount: sql<number>`count(*)::int`.as("follower_count"),
			})
			.from(collectionFollow)
			.groupBy(collectionFollow.collectionId);

		const countMap = new Map(
			followerCounts.map((r) => [r.collectionId, r.followerCount]),
		);

		// Public, non-trashed collections with owner
		const collections = await db.query.collection.findMany({
			where: and(
				eq(collection.visibility, "public"),
				eq(collection.isTrashed, false),
			),
			columns: {
				id: true,
				name: true,
				color: true,
				userId: true,
			},
			with: {
				user: {
					columns: {
						id: true,
						name: true,
						username: true,
						image: true,
					},
				},
			},
		});

		const withCount = collections
			.map((c) => ({
				id: c.id,
				name: c.name,
				color: c.color,
				owner: c.user
					? {
							id: c.user.id,
							name: c.user.name,
							username: c.user.username,
							image: c.user.image,
						}
					: null,
				followerCount: countMap.get(c.id) ?? 0,
			}))
			.filter((c) => c.followerCount > 0)
			.sort((a, b) => b.followerCount - a.followerCount)
			.slice(0, EXPLORE_LIMIT);

		// Attach bookmark count and isFollowing
		const result = await Promise.all(
			withCount.map(async (c) => {
				const [bookmarkCount, follow] = await Promise.all([
					db.$count(
						bookmark,
						and(
							eq(bookmark.collectionId, c.id),
							eq(bookmark.isTrashed, false),
							eq(bookmark.visibility, "public"),
						),
					),
					db.query.collectionFollow.findFirst({
						where: and(
							eq(collectionFollow.followerId, activeUser.id),
							eq(collectionFollow.collectionId, c.id),
						),
					}),
				]);
				return {
					...c,
					bookmarkCount,
					isFollowing: !!follow,
				};
			}),
		);

		return result;
	})

	// ─── GET trending (sites/domains most saved in public bookmarks) ───────────
	.get("/trending", async ({ user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		// Group public non-trashed bookmarks by domain, count saves, one example URL per domain
		const result = await db.execute(sql`
			SELECT
				lower(regexp_replace(substring(url from '^https?://([^/]+)'), '^www\.', '')) AS domain,
				count(*)::int AS save_count,
				min(url) AS example_url
			FROM bookmark
			WHERE visibility = 'public' AND is_trashed = false
			GROUP BY lower(regexp_replace(substring(url from '^https?://([^/]+)'), '^www\.', ''))
			ORDER BY save_count DESC
			LIMIT ${EXPLORE_LIMIT}
		`);

		const rows =
			(
				result as unknown as {
					rows: { domain: string; save_count: number; example_url: string }[];
				}
			).rows ?? [];
		return rows.map((r) => ({
			domain: r.domain,
			saveCount: r.save_count,
			exampleUrl: r.example_url,
		}));
	});
