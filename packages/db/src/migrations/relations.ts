import { relations } from "drizzle-orm/relations";
import { user, tag, account, session, bookmark, collection, bookmarkTag, collectionFollow, userFollow, userAchievement, userAchievementStats, adminActionLog, friendship, friendRequest, share } from "./schema";

export const tagRelations = relations(tag, ({one, many}) => ({
	user: one(user, {
		fields: [tag.userId],
		references: [user.id]
	}),
	bookmarkTags: many(bookmarkTag),
}));

export const userRelations = relations(user, ({one, many}) => ({
	tags: many(tag),
	user: one(user, {
		fields: [user.bannedByUserId],
		references: [user.id],
		relationName: "user_bannedByUserId_user_id"
	}),
	users: many(user, {
		relationName: "user_bannedByUserId_user_id"
	}),
	accounts: many(account),
	sessions: many(session),
	bookmarks: many(bookmark),
	collections: many(collection),
	collectionFollows: many(collectionFollow),
	userFollows_followerId: many(userFollow, {
		relationName: "userFollow_followerId_user_id"
	}),
	userFollows_followingId: many(userFollow, {
		relationName: "userFollow_followingId_user_id"
	}),
	userAchievements: many(userAchievement),
	userAchievementStats: many(userAchievementStats),
	adminActionLogs_adminUserId: many(adminActionLog, {
		relationName: "adminActionLog_adminUserId_user_id"
	}),
	adminActionLogs_targetUserId: many(adminActionLog, {
		relationName: "adminActionLog_targetUserId_user_id"
	}),
	friendships_userIdA: many(friendship, {
		relationName: "friendship_userIdA_user_id"
	}),
	friendships_userIdB: many(friendship, {
		relationName: "friendship_userIdB_user_id"
	}),
	friendRequests_requesterId: many(friendRequest, {
		relationName: "friendRequest_requesterId_user_id"
	}),
	friendRequests_addresseeId: many(friendRequest, {
		relationName: "friendRequest_addresseeId_user_id"
	}),
	shares_senderId: many(share, {
		relationName: "share_senderId_user_id"
	}),
	shares_recipientId: many(share, {
		relationName: "share_recipientId_user_id"
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const bookmarkRelations = relations(bookmark, ({one, many}) => ({
	user: one(user, {
		fields: [bookmark.userId],
		references: [user.id]
	}),
	collection: one(collection, {
		fields: [bookmark.collectionId],
		references: [collection.id]
	}),
	bookmarkTags: many(bookmarkTag),
	shares: many(share),
}));

export const collectionRelations = relations(collection, ({one, many}) => ({
	bookmarks: many(bookmark),
	user: one(user, {
		fields: [collection.userId],
		references: [user.id]
	}),
	collectionFollows: many(collectionFollow),
	shares: many(share),
}));

export const bookmarkTagRelations = relations(bookmarkTag, ({one}) => ({
	bookmark: one(bookmark, {
		fields: [bookmarkTag.bookmarkId],
		references: [bookmark.id]
	}),
	tag: one(tag, {
		fields: [bookmarkTag.tagId],
		references: [tag.id]
	}),
}));

export const collectionFollowRelations = relations(collectionFollow, ({one}) => ({
	user: one(user, {
		fields: [collectionFollow.followerId],
		references: [user.id]
	}),
	collection: one(collection, {
		fields: [collectionFollow.collectionId],
		references: [collection.id]
	}),
}));

export const userFollowRelations = relations(userFollow, ({one}) => ({
	user_followerId: one(user, {
		fields: [userFollow.followerId],
		references: [user.id],
		relationName: "userFollow_followerId_user_id"
	}),
	user_followingId: one(user, {
		fields: [userFollow.followingId],
		references: [user.id],
		relationName: "userFollow_followingId_user_id"
	}),
}));

export const userAchievementRelations = relations(userAchievement, ({one}) => ({
	user: one(user, {
		fields: [userAchievement.userId],
		references: [user.id]
	}),
}));

export const userAchievementStatsRelations = relations(userAchievementStats, ({one}) => ({
	user: one(user, {
		fields: [userAchievementStats.userId],
		references: [user.id]
	}),
}));

export const adminActionLogRelations = relations(adminActionLog, ({one}) => ({
	user_adminUserId: one(user, {
		fields: [adminActionLog.adminUserId],
		references: [user.id],
		relationName: "adminActionLog_adminUserId_user_id"
	}),
	user_targetUserId: one(user, {
		fields: [adminActionLog.targetUserId],
		references: [user.id],
		relationName: "adminActionLog_targetUserId_user_id"
	}),
}));

export const friendshipRelations = relations(friendship, ({one}) => ({
	user_userIdA: one(user, {
		fields: [friendship.userIdA],
		references: [user.id],
		relationName: "friendship_userIdA_user_id"
	}),
	user_userIdB: one(user, {
		fields: [friendship.userIdB],
		references: [user.id],
		relationName: "friendship_userIdB_user_id"
	}),
}));

export const friendRequestRelations = relations(friendRequest, ({one}) => ({
	user_requesterId: one(user, {
		fields: [friendRequest.requesterId],
		references: [user.id],
		relationName: "friendRequest_requesterId_user_id"
	}),
	user_addresseeId: one(user, {
		fields: [friendRequest.addresseeId],
		references: [user.id],
		relationName: "friendRequest_addresseeId_user_id"
	}),
}));

export const shareRelations = relations(share, ({one}) => ({
	user_senderId: one(user, {
		fields: [share.senderId],
		references: [user.id],
		relationName: "share_senderId_user_id"
	}),
	user_recipientId: one(user, {
		fields: [share.recipientId],
		references: [user.id],
		relationName: "share_recipientId_user_id"
	}),
	bookmark: one(bookmark, {
		fields: [share.bookmarkId],
		references: [bookmark.id]
	}),
	collection: one(collection, {
		fields: [share.collectionId],
		references: [collection.id]
	}),
}));