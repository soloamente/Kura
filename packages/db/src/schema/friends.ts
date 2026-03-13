/**
 * Friendship and share-to-friend schema.
 * Mutual friendship is gated by friend_request (pending → accept/deny);
 * friendship stores one row per pair with canonical ordering (userIdA < userIdB).
 * share records when a user shares a bookmark or collection with a friend.
 */
import { relations } from "drizzle-orm";
import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bookmark, collection } from "./bookmarks";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const friendRequestStatusEnum = pgEnum("friend_request_status", [
	"pending",
	"accepted",
	"denied",
]);

// ─── Friend request ───────────────────────────────────────────────────────────
// One row per request; idempotent send by (requesterId, addresseeId) when status = pending.

export const friendRequest = pgTable(
	"friend_request",
	{
		id: text("id").primaryKey(),
		requesterId: text("requester_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		addresseeId: text("addressee_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: friendRequestStatusEnum("status").default("pending").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		respondedAt: timestamp("responded_at"),
	},
	(table) => [
		index("friend_request_requester_idx").on(table.requesterId),
		index("friend_request_addressee_idx").on(table.addresseeId),
		index("friend_request_requester_addressee_idx").on(
			table.requesterId,
			table.addresseeId,
		),
	],
);

// ─── Friendship ──────────────────────────────────────────────────────────────
// One row per pair; canonical ordering userIdA < userIdB so "friends of X" is one query.

export const friendship = pgTable(
	"friendship",
	{
		userIdA: text("user_id_a")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		userIdB: text("user_id_b")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("friendship_pair_unique").on(table.userIdA, table.userIdB),
		index("friendship_user_id_a_idx").on(table.userIdA),
		index("friendship_user_id_b_idx").on(table.userIdB),
	],
);

// ─── Share (bookmark or collection shared to a friend) ─────────────────────────
// Exactly one of bookmarkId or collectionId must be set; enforced in API.

export const share = pgTable(
	"share",
	{
		id: text("id").primaryKey(),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		bookmarkId: text("bookmark_id").references(() => bookmark.id, {
			onDelete: "cascade",
		}),
		collectionId: text("collection_id").references(() => collection.id, {
			onDelete: "cascade",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("share_recipient_idx").on(table.recipientId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const friendRequestRelations = relations(friendRequest, ({ one }) => ({
	requester: one(user, {
		fields: [friendRequest.requesterId],
		references: [user.id],
		relationName: "friendRequestRequester",
	}),
	addressee: one(user, {
		fields: [friendRequest.addresseeId],
		references: [user.id],
		relationName: "friendRequestAddressee",
	}),
}));

export const friendshipRelations = relations(friendship, ({ one }) => ({
	userA: one(user, {
		fields: [friendship.userIdA],
		references: [user.id],
		relationName: "friendshipUserA",
	}),
	userB: one(user, {
		fields: [friendship.userIdB],
		references: [user.id],
		relationName: "friendshipUserB",
	}),
}));

export const shareRelations = relations(share, ({ one }) => ({
	sender: one(user, {
		fields: [share.senderId],
		references: [user.id],
		relationName: "shareSender",
	}),
	recipient: one(user, {
		fields: [share.recipientId],
		references: [user.id],
		relationName: "shareRecipient",
	}),
	bookmark: one(bookmark, {
		fields: [share.bookmarkId],
		references: [bookmark.id],
	}),
	collection: one(collection, {
		fields: [share.collectionId],
		references: [collection.id],
	}),
}));
