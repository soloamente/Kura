import { db } from "@Kura/db";
import {
	friendRequest,
	friendRequestStatusEnum,
	friendship,
} from "@Kura/db/schema/friends";
import { and, asc, desc, eq, or } from "drizzle-orm";

/**
 * Helpers for mutual friendship checks and friend request workflows.
 * These keep usersRouter lean and make it easier to reuse friendship logic
 * when we later enforce `friends` visibility on bookmarks and collections.
 */

export async function areFriends(userIdA: string, userIdB: string) {
	if (userIdA === userIdB) return false;

	const [a, b] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
	const existing = await db.query.friendship.findFirst({
		where: and(eq(friendship.userIdA, a), eq(friendship.userIdB, b)),
		columns: { userIdA: true },
	});

	return Boolean(existing);
}

export async function getFriendIds(userId: string) {
	const rows = await db.query.friendship.findMany({
		where: or(eq(friendship.userIdA, userId), eq(friendship.userIdB, userId)),
		orderBy: [asc(friendship.createdAt)],
	});

	return rows.map((row) =>
		row.userIdA === userId ? row.userIdB : row.userIdA,
	);
}

/**
 * Create a canonical friendship row for a pair of users.
 * This helper assumes that the caller has already validated that:
 * - the two ids are distinct
 * - they are not already friends
 */
export async function createFriendship(userIdA: string, userIdB: string) {
	if (userIdA === userIdB) {
		throw new Error("Cannot create friendship with self");
	}

	const [a, b] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];

	const existing = await db.query.friendship.findFirst({
		where: and(eq(friendship.userIdA, a), eq(friendship.userIdB, b)),
		columns: { userIdA: true },
	});
	if (existing) return;

	await db.insert(friendship).values({
		userIdA: a,
		userIdB: b,
	});
}

export async function markFriendRequestAccepted(requestId: string, now: Date) {
	const [updated] = await db
		.update(friendRequest)
		.set({
			status: "accepted",
			respondedAt: now,
		})
		.where(eq(friendRequest.id, requestId))
		.returning();

	return updated ?? null;
}

export async function markFriendRequestDenied(requestId: string, now: Date) {
	const [updated] = await db
		.update(friendRequest)
		.set({
			status: "denied",
			respondedAt: now,
		})
		.where(eq(friendRequest.id, requestId))
		.returning();

	return updated ?? null;
}

export async function listPendingFriendRequests(userId: string) {
	const incoming = await db.query.friendRequest.findMany({
		where: and(
			eq(friendRequest.addresseeId, userId),
			eq(friendRequest.status, "pending"),
		),
		orderBy: [desc(friendRequest.createdAt)],
	});

	const outgoing = await db.query.friendRequest.findMany({
		where: and(
			eq(friendRequest.requesterId, userId),
			eq(friendRequest.status, "pending"),
		),
		orderBy: [desc(friendRequest.createdAt)],
	});

	return { incoming, outgoing };
}

export const FRIEND_REQUEST_PENDING = friendRequestStatusEnum.enumValues[0];
