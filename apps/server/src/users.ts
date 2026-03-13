import { db } from "@Kura/db";
import { user } from "@Kura/db/schema/auth";
import {
	bookmark,
	collection,
	collectionFollow,
	userFollow,
} from "@Kura/db/schema/bookmarks";
import { friendRequest, friendship, share } from "@Kura/db/schema/friends";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import {
	getBadgesPayloadForUser,
	getPublicBadgesForUser,
	recomputeStatsForUser,
	recordActivityAndEvaluate,
} from "./achievements";
import {
	areFriends,
	createFriendship,
	listPendingFriendRequests,
} from "./friends";
import { authMiddleware } from "./middleware/auth";
import { getActiveUser } from "./middleware/auth-guards";

export const usersRouter = new Elysia({ prefix: "/users" })
	.use(authMiddleware)

	// ─── GET current user profile ─────────────────────────────────────────────
	.get("/me", async ({ user: me, set }) => {
		if (!me) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const profile = await db.query.user.findFirst({
			where: eq(user.id, me.id),
			columns: {
				id: true,
				name: true,
				email: true,
				role: true,
				status: true,
				username: true,
				bio: true,
				image: true,
				banner: true,
				createdAt: true,
			},
		});

		return profile;
	})

	// ─── GET current user badges ──────────────────────────────────────────────
	.get("/me/badges", async ({ user: me, set }) => {
		if (!me) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const payload = await getBadgesPayloadForUser(me.id);
		if (!payload) {
			set.status = 404;
			return { message: "User not found" };
		}

		return payload;
	})

	// ─── POST send friend request ────────────────────────────────────────────
	.post(
		"/me/friend-requests",
		async ({ user: me, body, set }) => {
			const activeUser = getActiveUser(me, set);
			if ("message" in activeUser) return activeUser;

			const target = await db.query.user.findFirst({
				where: eq(user.username, body.username),
				columns: { id: true },
			});
			if (!target) {
				set.status = 404;
				return { message: "User not found" };
			}
			if (target.id === activeUser.id) {
				set.status = 400;
				return { message: "Cannot send friend request to yourself" };
			}

			// If they are already friends, treat this as success.
			if (await areFriends(activeUser.id, target.id)) {
				return { success: true, alreadyFriends: true };
			}

			// Idempotent pending request between the same pair.
			const existing = await db.query.friendRequest.findFirst({
				where: and(
					eq(friendRequest.requesterId, activeUser.id),
					eq(friendRequest.addresseeId, target.id),
					eq(friendRequest.status, "pending"),
				),
				columns: { id: true },
			});
			if (existing) {
				return { success: true, alreadyPending: true };
			}

			const [created] = await db
				.insert(friendRequest)
				.values({
					id: crypto.randomUUID(),
					requesterId: activeUser.id,
					addresseeId: target.id,
					status: "pending",
				})
				.returning();

			return { success: true, request: created };
		},
		{
			body: t.Object({
				username: t.String(),
			}),
		},
	)

	// ─── GET current user friends & pending requests ─────────────────────────
	.get("/me/friends", async ({ user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		// Fetch the ids of users this viewer is friends with.
		const friendships = await db.query.friendship.findMany({
			where: or(
				eq(friendship.userIdA, activeUser.id),
				eq(friendship.userIdB, activeUser.id),
			),
			orderBy: [desc(friendship.createdAt)],
		});

		const friendIds = friendships.map((row) =>
			row.userIdA === activeUser.id ? row.userIdB : row.userIdA,
		);

		const friends =
			friendIds.length === 0
				? []
				: await db.query.user.findMany({
						where: inArray(user.id, friendIds),
						columns: {
							id: true,
							name: true,
							username: true,
							image: true,
							createdAt: true,
						},
					});

		const pending = await listPendingFriendRequests(activeUser.id);

		const relatedIds = new Set<string>();
		for (const r of pending.incoming) relatedIds.add(r.requesterId);
		for (const r of pending.outgoing) relatedIds.add(r.addresseeId);

		const relatedUsers =
			relatedIds.size === 0
				? []
				: await db.query.user.findMany({
						where: inArray(user.id, Array.from(relatedIds)),
						columns: { id: true, name: true, username: true, image: true },
					});

		const userMap = new Map(relatedUsers.map((u) => [u.id, u]));

		return {
			friends,
			pending: {
				incoming: pending.incoming.map((r) => ({
					...r,
					requester: userMap.get(r.requesterId) ?? null,
				})),
				outgoing: pending.outgoing.map((r) => ({
					...r,
					addressee: userMap.get(r.addresseeId) ?? null,
				})),
			},
		};
	})

	// ─── POST accept friend request ──────────────────────────────────────────
	.post("/me/friend-requests/:id/accept", async ({ user: me, params, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const existing = await db.query.friendRequest.findFirst({
			where: eq(friendRequest.id, params.id),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Friend request not found" };
		}

		if (existing.addresseeId !== activeUser.id) {
			set.status = 403;
			return { message: "Not allowed to accept this request" };
		}

		if (existing.status !== "pending") {
			return { success: true, alreadyResolved: true, status: existing.status };
		}

		const now = new Date();
		const [updated] = await db
			.update(friendRequest)
			.set({
				status: "accepted",
				respondedAt: now,
			})
			.where(eq(friendRequest.id, params.id))
			.returning();

		if (!updated) {
			set.status = 500;
			return { message: "Failed to accept friend request" };
		}

		await createFriendship(updated.requesterId, updated.addresseeId);

		return { success: true };
	})

	// ─── POST deny friend request ─────────────────────────────────────────────
	.post("/me/friend-requests/:id/deny", async ({ user: me, params, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const existing = await db.query.friendRequest.findFirst({
			where: eq(friendRequest.id, params.id),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Friend request not found" };
		}

		if (existing.addresseeId !== activeUser.id) {
			set.status = 403;
			return { message: "Not allowed to deny this request" };
		}

		if (existing.status !== "pending") {
			return { success: true, alreadyResolved: true, status: existing.status };
		}

		const now = new Date();
		await db
			.update(friendRequest)
			.set({
				status: "denied",
				respondedAt: now,
			})
			.where(eq(friendRequest.id, params.id));

		return { success: true };
	})

	// ─── DELETE cancel (withdraw) an outgoing friend request ──────────────────
	.delete("/me/friend-requests/:id", async ({ user: me, params, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const existing = await db.query.friendRequest.findFirst({
			where: eq(friendRequest.id, params.id),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Friend request not found" };
		}

		// Only the original requester can cancel, and only while pending.
		if (existing.requesterId !== activeUser.id) {
			set.status = 403;
			return { message: "Not allowed to cancel this request" };
		}
		if (existing.status !== "pending") {
			// Treat already-resolved requests as a no-op so the UI can safely retry.
			return { success: true, alreadyResolved: true, status: existing.status };
		}

		await db.delete(friendRequest).where(eq(friendRequest.id, params.id));

		return { success: true };
	})

	// ─── DELETE remove friend ─────────────────────────────────────────────────
	.delete("/me/friends/:username", async ({ user: me, params, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const target = await db.query.user.findFirst({
			where: eq(user.username, params.username),
			columns: { id: true },
		});
		if (!target) {
			set.status = 404;
			return { message: "User not found" };
		}
		if (target.id === activeUser.id) {
			set.status = 400;
			return { message: "Cannot unfriend yourself" };
		}

		const [a, b] =
			activeUser.id < target.id
				? [activeUser.id, target.id]
				: [target.id, activeUser.id];

		const result = await db
			.delete(friendship)
			.where(and(eq(friendship.userIdA, a), eq(friendship.userIdB, b)))
			.returning({ userIdA: friendship.userIdA });

		if (result.length === 0) {
			set.status = 404;
			return { message: "Not friends" };
		}

		return { success: true };
	})

	// ─── POST recompute current user badges ───────────────────────────────────
	.post("/me/badges/recompute", async ({ user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const stats = await recomputeStatsForUser(activeUser.id);
		if (!stats) {
			set.status = 404;
			return { message: "User not found" };
		}

		return { success: true, stats };
	})

	// ─── PATCH update current user profile ───────────────────────────────────
	.patch(
		"/me",
		async ({ user: me, body, set }) => {
			const activeUser = getActiveUser(me, set);
			if ("message" in activeUser) return activeUser;

			// check username uniqueness if changing it
			if (body.username) {
				const existing = await db.query.user.findFirst({
					where: and(
						eq(user.username, body.username),
						ne(user.id, activeUser.id),
					),
				});
				if (existing) {
					set.status = 409;
					return { message: "Username already taken" };
				}
			}

			const [updated] = await db
				.update(user)
				.set({
					...(body.name && { name: body.name }),
					...(body.username !== undefined && { username: body.username }),
					...(body.bio !== undefined && { bio: body.bio }),
					...(body.image !== undefined && { image: body.image }),
					...(body.banner !== undefined && { banner: body.banner }),
					updatedAt: new Date(),
				})
				.where(eq(user.id, activeUser.id))
				.returning({
					id: user.id,
					name: user.name,
					username: user.username,
					bio: user.bio,
					image: user.image,
					banner: user.banner,
				});

			return updated;
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				username: t.Optional(t.Nullable(t.String())),
				bio: t.Optional(t.Nullable(t.String())),
				image: t.Optional(t.Nullable(t.String())),
				banner: t.Optional(t.Nullable(t.String())),
			}),
		},
	)

	// ─── GET public profile by username ──────────────────────────────────────
	.get("/:username", async ({ params, user: me, set }) => {
		const profile = await db.query.user.findFirst({
			where: eq(user.username, params.username),
			columns: {
				id: true,
				name: true,
				username: true,
				bio: true,
				image: true,
				banner: true,
				createdAt: true,
			},
		});

		if (!profile) {
			set.status = 404;
			return { message: "User not found" };
		}

		// follower / following counts
		const [followerCount, followingCount] = await Promise.all([
			db.$count(userFollow, eq(userFollow.followingId, profile.id)),
			db.$count(userFollow, eq(userFollow.followerId, profile.id)),
		]);

		// is the current user following this profile?
		let isFollowing = false;
		if (me && me.id !== profile.id) {
			const follow = await db.query.userFollow.findFirst({
				where: and(
					eq(userFollow.followerId, me.id),
					eq(userFollow.followingId, profile.id),
				),
			});
			isFollowing = !!follow;
		}

		return { ...profile, followerCount, followingCount, isFollowing };
	})

	// ─── GET public badges by username ────────────────────────────────────────
	.get("/:username/badges", async ({ params, set }) => {
		const profile = await db.query.user.findFirst({
			where: eq(user.username, params.username),
			columns: { id: true },
		});
		if (!profile) {
			set.status = 404;
			return { message: "User not found" };
		}

		return getPublicBadgesForUser(profile.id);
	})

	// ─── GET public bookmarks for a user ─────────────────────────────────────
	.get("/:username/bookmarks", async ({ params, user: me, set }) => {
		const profile = await db.query.user.findFirst({
			where: eq(user.username, params.username),
			columns: { id: true },
		});
		if (!profile) {
			set.status = 404;
			return { message: "User not found" };
		}

		const isOwner = me && me.id === profile.id;
		const isFriend =
			!isOwner && me ? await areFriends(me.id, profile.id) : false;

		const visibilityFilter =
			isOwner || isFriend
				? or(
						eq(bookmark.visibility, "public"),
						eq(bookmark.visibility, "friends"),
					)
				: eq(bookmark.visibility, "public");

		return db.query.bookmark.findMany({
			where: and(
				eq(bookmark.userId, profile.id),
				visibilityFilter,
				eq(bookmark.isTrashed, false),
			),
			with: { collection: { columns: { id: true, name: true, color: true } } },
			orderBy: [desc(bookmark.createdAt)],
		});
	})

	// ─── GET public collections for a user ───────────────────────────────────
	.get("/:username/collections", async ({ params, user: me, set }) => {
		const profile = await db.query.user.findFirst({
			where: eq(user.username, params.username),
			columns: { id: true },
		});
		if (!profile) {
			set.status = 404;
			return { message: "User not found" };
		}

		const isOwner = me && me.id === profile.id;
		const isFriend =
			!isOwner && me ? await areFriends(me.id, profile.id) : false;

		const visibilityFilter =
			isOwner || isFriend
				? or(
						eq(collection.visibility, "public"),
						eq(collection.visibility, "friends"),
					)
				: eq(collection.visibility, "public");

		const collections = await db.query.collection.findMany({
			where: and(
				eq(collection.userId, profile.id),
				visibilityFilter,
				eq(collection.isTrashed, false),
			),
			orderBy: [desc(collection.createdAt)],
		});

		// attach bookmark count and whether current user follows each
		const withMeta = await Promise.all(
			collections.map(async (c) => {
				const [bookmarkCount, followerCount] = await Promise.all([
					// Count only non-trashed, publicly visible bookmarks in this collection
					db.$count(
						bookmark,
						and(
							eq(bookmark.collectionId, c.id),
							eq(bookmark.isTrashed, false),
							eq(bookmark.visibility, "public"),
						),
					),
					db.$count(collectionFollow, eq(collectionFollow.collectionId, c.id)),
				]);

				let isFollowing = false;
				if (me) {
					const follow = await db.query.collectionFollow.findFirst({
						where: and(
							eq(collectionFollow.followerId, me.id),
							eq(collectionFollow.collectionId, c.id),
						),
					});
					isFollowing = !!follow;
				}

				return { ...c, bookmarkCount, followerCount, isFollowing };
			}),
		);

		return withMeta;
	})

	// ─── POST follow a user ───────────────────────────────────────────────────
	.post("/:username/follow", async ({ params, user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const target = await db.query.user.findFirst({
			where: eq(user.username, params.username),
			columns: { id: true },
		});
		if (!target) {
			set.status = 404;
			return { message: "User not found" };
		}
		if (target.id === activeUser.id) {
			set.status = 400;
			return { message: "Cannot follow yourself" };
		}

		// idempotent — ignore if already following
		const existing = await db.query.userFollow.findFirst({
			where: and(
				eq(userFollow.followerId, activeUser.id),
				eq(userFollow.followingId, target.id),
			),
		});
		if (existing) return { success: true };

		await db.insert(userFollow).values({
			followerId: activeUser.id,
			followingId: target.id,
		});

		// Update the followed user's social-achievement counters immediately.
		await recordActivityAndEvaluate(target.id, "follower_added");

		return { success: true };
	})

	// ─── DELETE unfollow a user ───────────────────────────────────────────────
	.delete("/:username/follow", async ({ params, user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const target = await db.query.user.findFirst({
			where: eq(user.username, params.username),
			columns: { id: true },
		});
		if (!target) {
			set.status = 404;
			return { message: "User not found" };
		}

		await db
			.delete(userFollow)
			.where(
				and(
					eq(userFollow.followerId, activeUser.id),
					eq(userFollow.followingId, target.id),
				),
			);

		// Keep follower-based badges in sync when someone unfollows.
		await recordActivityAndEvaluate(target.id, "follower_removed");

		return { success: true };
	})

	// ─── POST follow a collection ─────────────────────────────────────────────
	.post("/collections/:id/follow", async ({ params, user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const coll = await db.query.collection.findFirst({
			where: and(
				eq(collection.id, params.id),
				eq(collection.visibility, "public"),
			),
			columns: { id: true, userId: true },
		});
		if (!coll) {
			set.status = 404;
			return { message: "Collection not found" };
		}
		if (coll.userId === activeUser.id) {
			set.status = 400;
			return { message: "Cannot follow your own collection" };
		}

		const existing = await db.query.collectionFollow.findFirst({
			where: and(
				eq(collectionFollow.followerId, activeUser.id),
				eq(collectionFollow.collectionId, params.id),
			),
		});
		if (existing) return { success: true };

		await db.insert(collectionFollow).values({
			followerId: activeUser.id,
			collectionId: params.id,
		});

		// Following public collections is also part of the achievements model.
		await recordActivityAndEvaluate(activeUser.id, "collection_followed");

		return { success: true };
	})

	// ─── DELETE unfollow a collection ─────────────────────────────────────────
	.delete("/collections/:id/follow", async ({ params, user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		await db
			.delete(collectionFollow)
			.where(
				and(
					eq(collectionFollow.followerId, activeUser.id),
					eq(collectionFollow.collectionId, params.id),
				),
			);

		await recordActivityAndEvaluate(activeUser.id, "collection_unfollowed");

		return { success: true };
	})

	// ─── GET followed collections (for dashboard header) ─────────────────────
	.get("/me/followed-collections", async ({ user: me, set }) => {
		if (!me) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const follows = await db.query.collectionFollow.findMany({
			where: eq(collectionFollow.followerId, me.id),
			with: {
				collection: {
					with: {
						user: {
							columns: { id: true, name: true, username: true, image: true },
						},
					},
				},
			},
			orderBy: [desc(collectionFollow.createdAt)],
		});

		return follows.map((f) => ({
			...f.collection,
			owner: f.collection.user,
		}));
	})

	// ─── GET bookmarks for a followed collection ──────────────────────────────
	.get("/collections/:id/bookmarks", async ({ params, user: me, set }) => {
		if (!me) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		// verify user follows this collection
		const follow = await db.query.collectionFollow.findFirst({
			where: and(
				eq(collectionFollow.followerId, me.id),
				eq(collectionFollow.collectionId, params.id),
			),
		});
		if (!follow) {
			set.status = 403;
			return { message: "Not following this collection" };
		}

		return db.query.bookmark.findMany({
			where: and(
				eq(bookmark.collectionId, params.id),
				eq(bookmark.isTrashed, false),
				eq(bookmark.visibility, "public"),
			),
			orderBy: [desc(bookmark.createdAt)],
		});
	})

	// ─── GET public bookmarks for a collection (no auth required) ─────────────
	// Used by the public profile view to show bookmarks when expanding a card.
	.get("/collections/:id/public-bookmarks", async ({ params, set }) => {
		// ensure the collection exists and is public
		const coll = await db.query.collection.findFirst({
			where: and(
				eq(collection.id, params.id),
				eq(collection.visibility, "public"),
				eq(collection.isTrashed, false),
			),
			columns: { id: true },
		});
		if (!coll) {
			set.status = 404;
			return { message: "Collection not found" };
		}

		return db.query.bookmark.findMany({
			where: and(
				eq(bookmark.collectionId, params.id),
				eq(bookmark.isTrashed, false),
				eq(bookmark.visibility, "public"),
			),
			columns: {
				id: true,
				url: true,
				title: true,
				favicon: true,
				siteName: true,
			},
			orderBy: [desc(bookmark.createdAt)],
			limit: 20,
		});
	})

	// ─── GET feed (bookmarks from followed users) ─────────────────────────────
	.get("/me/feed", async ({ user: me, set }) => {
		if (!me) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		// get all user IDs this user follows
		const following = await db.query.userFollow.findMany({
			where: eq(userFollow.followerId, me.id),
			columns: { followingId: true },
		});

		if (following.length === 0) return [];

		const followingIds = following.map((f) => f.followingId);

		return db.query.bookmark.findMany({
			where: and(
				inArray(bookmark.userId, followingIds),
				eq(bookmark.visibility, "public"),
				eq(bookmark.isTrashed, false),
			),
			with: {
				user: {
					columns: { id: true, name: true, username: true, image: true },
				},
				collection: { columns: { id: true, name: true, color: true } },
			},
			orderBy: [desc(bookmark.createdAt)],
			limit: 100,
		});
	})

	// ─── POST share bookmark or collection with a friend ─────────────────────
	.post(
		"/me/share",
		async ({ user: me, body, set }) => {
			const activeUser = getActiveUser(me, set);
			if ("message" in activeUser) return activeUser;

			const { bookmarkId, collectionId, recipientUsername } = body;

			const hasBookmark =
				typeof bookmarkId === "string" && bookmarkId.length > 0;
			const hasCollection =
				typeof collectionId === "string" && collectionId.length > 0;
			if ((hasBookmark && hasCollection) || (!hasBookmark && !hasCollection)) {
				set.status = 400;
				return {
					message:
						"Provide exactly one of bookmarkId or collectionId when sharing",
				};
			}

			const recipient = await db.query.user.findFirst({
				where: eq(user.username, recipientUsername),
				columns: { id: true },
			});
			if (!recipient) {
				set.status = 404;
				return { message: "Recipient not found" };
			}
			if (recipient.id === activeUser.id) {
				set.status = 400;
				return { message: "Cannot share items with yourself" };
			}

			if (!(await areFriends(activeUser.id, recipient.id))) {
				set.status = 403;
				return { message: "Can only share items with friends" };
			}

			if (hasBookmark) {
				const owned = await db.query.bookmark.findFirst({
					where: and(
						eq(bookmark.id, bookmarkId),
						eq(bookmark.userId, activeUser.id),
					),
					columns: { id: true },
				});
				if (!owned) {
					set.status = 404;
					return { message: "Bookmark not found" };
				}
			}

			if (hasCollection) {
				const owned = await db.query.collection.findFirst({
					where: and(
						eq(collection.id, collectionId),
						eq(collection.userId, activeUser.id),
					),
					columns: { id: true },
				});
				if (!owned) {
					set.status = 404;
					return { message: "Collection not found" };
				}
			}

			// Idempotent share: if this sender has already shared this bookmark or
			// collection with this recipient, treat it as success and surface a
			// hint to the client instead of creating a duplicate row.
			const existingShare = await db.query.share.findFirst({
				where: and(
					eq(share.senderId, activeUser.id),
					eq(share.recipientId, recipient.id),
					hasBookmark && bookmarkId
						? eq(share.bookmarkId, bookmarkId)
						: hasCollection && collectionId
							? eq(share.collectionId, collectionId)
							: // This branch should be unreachable due to validation above; fall back
								// to a simple sender/recipient match if ids are unexpectedly missing.
								eq(share.recipientId, recipient.id),
				),
				columns: { id: true, createdAt: true },
			});
			if (existingShare) {
				return {
					success: true,
					alreadyShared: true,
					shareId: existingShare.id,
				};
			}

			const [created] = await db
				.insert(share)
				.values({
					id: crypto.randomUUID(),
					senderId: activeUser.id,
					recipientId: recipient.id,
					bookmarkId: hasBookmark ? bookmarkId : null,
					collectionId: hasCollection ? collectionId : null,
				})
				.returning();

			return { success: true, share: created };
		},
		{
			body: t.Object({
				bookmarkId: t.Optional(t.Nullable(t.String())),
				collectionId: t.Optional(t.Nullable(t.String())),
				recipientUsername: t.String(),
			}),
		},
	)

	// ─── GET items shared with the current user ───────────────────────────────
	.get("/me/shared-with-me", async ({ user: me, set }) => {
		const activeUser = getActiveUser(me, set);
		if ("message" in activeUser) return activeUser;

		const rows = await db.query.share.findMany({
			where: eq(share.recipientId, activeUser.id),
			with: {
				sender: {
					columns: { id: true, name: true, username: true, image: true },
				},
				bookmark: {
					columns: {
						id: true,
						url: true,
						title: true,
						favicon: true,
						siteName: true,
					},
				},
				collection: {
					columns: {
						id: true,
						name: true,
						color: true,
					},
				},
			},
			orderBy: [desc(share.createdAt)],
		});

		return rows.map((row) => ({
			id: row.id,
			createdAt: row.createdAt,
			sender: row.sender,
			bookmark: row.bookmark,
			collection: row.collection,
		}));
	});
