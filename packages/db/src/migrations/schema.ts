import { pgTable, index, foreignKey, text, timestamp, unique, boolean, integer, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const achievementKind = pgEnum("achievement_kind", ['bookmarks_total', 'bookmarks_read', 'bookmarks_favorited', 'public_collections', 'followers_total', 'followed_collections', 'account_age', 'daily_streak', 'xp_level'])
export const adminAction = pgEnum("admin_action", ['ban_user', 'unban_user'])
export const badgeCelebration = pgEnum("badge_celebration", ['subtle', 'rare', 'epic'])
export const friendRequestStatus = pgEnum("friend_request_status", ['pending', 'accepted', 'denied'])
export const userRole = pgEnum("user_role", ['user', 'admin'])
export const userStatus = pgEnum("user_status", ['active', 'banned'])
export const visibility = pgEnum("visibility", ['private', 'friends', 'public'])


export const tag = pgTable("tag", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: text().notNull(),
	color: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("tag_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "tag_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	username: text(),
	bio: text(),
	banner: text(),
	role: userRole().default('user').notNull(),
	status: userStatus().default('active').notNull(),
	bannedAt: timestamp("banned_at", { mode: 'string' }),
	banReason: text("ban_reason"),
	bannedByUserId: text("banned_by_user_id"),
}, (table) => [
	foreignKey({
			columns: [table.bannedByUserId],
			foreignColumns: [table.id],
			name: "user_banned_by_user_id_user_id_fk"
		}).onDelete("set null"),
	unique("user_email_unique").on(table.email),
	unique("user_username_unique").on(table.username),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const bookmark = pgTable("bookmark", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	collectionId: text("collection_id"),
	url: text().notNull(),
	title: text(),
	description: text(),
	image: text(),
	favicon: text(),
	siteName: text("site_name"),
	visibility: visibility().default('private').notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	isFavorite: boolean("is_favorite").default(false).notNull(),
	isTrashed: boolean("is_trashed").default(false).notNull(),
	trashedAt: timestamp("trashed_at", { mode: 'string' }),
	summary: text(),
	transcript: text(),
	embeddings: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("bookmark_collectionId_idx").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("bookmark_isRead_idx").using("btree", table.isRead.asc().nullsLast().op("bool_ops")),
	index("bookmark_isTrashed_idx").using("btree", table.isTrashed.asc().nullsLast().op("bool_ops")),
	index("bookmark_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("bookmark_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "bookmark_user_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.collectionId],
			foreignColumns: [collection.id],
			name: "bookmark_collection_id_collection_id_fk"
		}).onDelete("set null"),
]);

export const bookmarkTag = pgTable("bookmark_tag", {
	bookmarkId: text("bookmark_id").notNull(),
	tagId: text("tag_id").notNull(),
}, (table) => [
	index("bookmarkTag_bookmarkId_idx").using("btree", table.bookmarkId.asc().nullsLast().op("text_ops")),
	index("bookmarkTag_tagId_idx").using("btree", table.tagId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.bookmarkId],
			foreignColumns: [bookmark.id],
			name: "bookmark_tag_bookmark_id_bookmark_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tag.id],
			name: "bookmark_tag_tag_id_tag_id_fk"
		}).onDelete("cascade"),
]);

export const collection = pgTable("collection", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: text().notNull(),
	description: text(),
	icon: text(),
	color: text(),
	visibility: visibility().default('private').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isTrashed: boolean("is_trashed").default(false).notNull(),
	trashedAt: timestamp("trashed_at", { mode: 'string' }),
}, (table) => [
	index("collection_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("collection_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "collection_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const collectionFollow = pgTable("collection_follow", {
	followerId: text("follower_id").notNull(),
	collectionId: text("collection_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("collectionFollow_collectionId_idx").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("collectionFollow_followerId_idx").using("btree", table.followerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.followerId],
			foreignColumns: [user.id],
			name: "collection_follow_follower_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.collectionId],
			foreignColumns: [collection.id],
			name: "collection_follow_collection_id_collection_id_fk"
		}).onDelete("cascade"),
]);

export const userFollow = pgTable("user_follow", {
	followerId: text("follower_id").notNull(),
	followingId: text("following_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("uf_followerId_idx").using("btree", table.followerId.asc().nullsLast().op("text_ops")),
	index("uf_followingId_idx").using("btree", table.followingId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.followerId],
			foreignColumns: [user.id],
			name: "user_follow_follower_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.followingId],
			foreignColumns: [user.id],
			name: "user_follow_following_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const userAchievement = pgTable("user_achievement", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	achievementId: text("achievement_id").notNull(),
	kind: achievementKind().notNull(),
	xpAwarded: integer("xp_awarded").default(0).notNull(),
	tier: integer(),
	unlockedAt: timestamp("unlocked_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("userAchievement_achievement_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.achievementId.asc().nullsLast().op("text_ops")),
	index("userAchievement_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "user_achievement_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const userAchievementStats = pgTable("user_achievement_stats", {
	userId: text("user_id").primaryKey().notNull(),
	totalBookmarks: integer("total_bookmarks").default(0).notNull(),
	totalReadBookmarks: integer("total_read_bookmarks").default(0).notNull(),
	totalFavoriteBookmarks: integer("total_favorite_bookmarks").default(0).notNull(),
	totalPublicCollections: integer("total_public_collections").default(0).notNull(),
	totalFollowers: integer("total_followers").default(0).notNull(),
	totalFollowedCollections: integer("total_followed_collections").default(0).notNull(),
	currentDailyStreak: integer("current_daily_streak").default(0).notNull(),
	longestDailyStreak: integer("longest_daily_streak").default(0).notNull(),
	lastActivityDate: timestamp("last_activity_date", { mode: 'string' }),
	totalXp: integer("total_xp").default(0).notNull(),
	level: integer().default(1).notNull(),
	extra: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "user_achievement_stats_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const achievementDefinition = pgTable("achievement_definition", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	icon: text().notNull(),
	xp: integer().default(0).notNull(),
	tier: integer(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isDiscoverable: boolean("is_discoverable").default(true).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isArchived: boolean("is_archived").default(false).notNull(),
	celebration: badgeCelebration().default('subtle').notNull(),
	rule: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("achievementDefinition_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops"), table.isArchived.asc().nullsLast().op("bool_ops")),
	index("achievementDefinition_sort_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
]);

export const adminActionLog = pgTable("admin_action_log", {
	id: text().primaryKey().notNull(),
	adminUserId: text("admin_user_id"),
	targetUserId: text("target_user_id"),
	action: adminAction().notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("adminActionLog_admin_idx").using("btree", table.adminUserId.asc().nullsLast().op("text_ops")),
	index("adminActionLog_target_idx").using("btree", table.targetUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.adminUserId],
			foreignColumns: [user.id],
			name: "admin_action_log_admin_user_id_user_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [user.id],
			name: "admin_action_log_target_user_id_user_id_fk"
		}).onDelete("set null"),
]);

export const friendship = pgTable("friendship", {
	userIdA: text("user_id_a").notNull(),
	userIdB: text("user_id_b").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("friendship_user_id_a_idx").using("btree", table.userIdA.asc().nullsLast().op("text_ops")),
	index("friendship_user_id_b_idx").using("btree", table.userIdB.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userIdA],
			foreignColumns: [user.id],
			name: "friendship_user_id_a_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userIdB],
			foreignColumns: [user.id],
			name: "friendship_user_id_b_user_id_fk"
		}).onDelete("cascade"),
	unique("friendship_pair_unique").on(table.userIdA, table.userIdB),
]);

export const friendRequest = pgTable("friend_request", {
	id: text().primaryKey().notNull(),
	requesterId: text("requester_id").notNull(),
	addresseeId: text("addressee_id").notNull(),
	status: friendRequestStatus().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
}, (table) => [
	index("friend_request_addressee_idx").using("btree", table.addresseeId.asc().nullsLast().op("text_ops")),
	index("friend_request_requester_addressee_idx").using("btree", table.requesterId.asc().nullsLast().op("text_ops"), table.addresseeId.asc().nullsLast().op("text_ops")),
	index("friend_request_requester_idx").using("btree", table.requesterId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.requesterId],
			foreignColumns: [user.id],
			name: "friend_request_requester_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.addresseeId],
			foreignColumns: [user.id],
			name: "friend_request_addressee_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const share = pgTable("share", {
	id: text().primaryKey().notNull(),
	senderId: text("sender_id").notNull(),
	recipientId: text("recipient_id").notNull(),
	bookmarkId: text("bookmark_id"),
	collectionId: text("collection_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("share_recipient_idx").using("btree", table.recipientId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [user.id],
			name: "share_sender_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.recipientId],
			foreignColumns: [user.id],
			name: "share_recipient_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookmarkId],
			foreignColumns: [bookmark.id],
			name: "share_bookmark_id_bookmark_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.collectionId],
			foreignColumns: [collection.id],
			name: "share_collection_id_collection_id_fk"
		}).onDelete("cascade"),
]);
