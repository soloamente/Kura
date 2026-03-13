import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { collection, collectionFollow, userFollow } from "./bookmarks";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "banned"]);
export const adminActionEnum = pgEnum("admin_action", [
	"ban_user",
	"unban_user",
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type AdminActionType = (typeof adminActionEnum.enumValues)[number];

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	role: userRoleEnum("role").notNull().default("user"),
	status: userStatusEnum("status").notNull().default("active"),
	bannedAt: timestamp("banned_at"),
	banReason: text("ban_reason"),
	bannedByUserId: text("banned_by_user_id").references(
		(): AnyPgColumn => user.id,
		{ onDelete: "set null" },
	),
	// ─── social ───────────────────────────────────────────────────────────────
	username: text("username").unique(),
	bio: text("bio"),
	banner: text("banner"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const adminActionLog = pgTable(
	"admin_action_log",
	{
		id: text("id").primaryKey(),
		adminUserId: text("admin_user_id").references((): AnyPgColumn => user.id, {
			onDelete: "set null",
		}),
		targetUserId: text("target_user_id").references(
			(): AnyPgColumn => user.id,
			{
				onDelete: "set null",
			},
		),
		action: adminActionEnum("action").notNull(),
		reason: text("reason"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("adminActionLog_admin_idx").on(table.adminUserId),
		index("adminActionLog_target_idx").on(table.targetUserId),
	],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	collections: many(collection),
	// people this user follows
	following: many(userFollow, { relationName: "follower" }),
	// people who follow this user
	followers: many(userFollow, { relationName: "following" }),
	// collections this user has subscribed to
	followedCollections: many(collectionFollow, { relationName: "follower" }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// userFollowRelations is defined in bookmarks.ts alongside the userFollow table.
