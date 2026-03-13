import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Enum to categorize different kinds of achievements (used by the engine to
// group and filter badges by family without baking thresholds into the DB).
export const achievementKindEnum = pgEnum("achievement_kind", [
	"bookmarks_total",
	"bookmarks_read",
	"bookmarks_favorited",
	"public_collections",
	"followers_total",
	"followed_collections",
	"account_age",
	"daily_streak",
	"xp_level",
]);

export const badgeCelebrationEnum = pgEnum("badge_celebration", [
	"subtle",
	"rare",
	"epic",
]);

export interface AchievementRuleRecord {
	type: "metric_threshold";
	metric: (typeof achievementKindEnum.enumValues)[number];
	threshold: number;
}

export const achievementDefinition = pgTable(
	"achievement_definition",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description").notNull(),
		icon: text("icon").notNull(),
		xp: integer("xp").notNull().default(0),
		tier: integer("tier"),
		sortOrder: integer("sort_order").notNull().default(0),
		isDiscoverable: boolean("is_discoverable").notNull().default(true),
		isActive: boolean("is_active").notNull().default(true),
		isArchived: boolean("is_archived").notNull().default(false),
		celebration: badgeCelebrationEnum("celebration")
			.notNull()
			.default("subtle"),
		rule: jsonb("rule").$type<AchievementRuleRecord>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("achievementDefinition_active_idx").on(
			table.isActive,
			table.isArchived,
		),
		index("achievementDefinition_sort_idx").on(table.sortOrder),
	],
);

// Per‑user unlocked achievements. The canonical badge definitions (name,
// description, icon, thresholds) live in application code; this table is the
// durable record of which ones a user has actually earned.
export const userAchievement = pgTable(
	"user_achievement",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		// Stable identifier that matches a definition in the server-side
		// achievements catalog, e.g. "first_bookmark" or "bookmarks_100".
		achievementId: text("achievement_id").notNull(),

		kind: achievementKindEnum("kind").notNull(),

		// XP granted when this achievement was unlocked. Keeping it here lets us
		// recompute total XP cheaply without re-deriving thresholds.
		xpAwarded: integer("xp_awarded").notNull().default(0),

		// Optional numeric tier for achievements that have multiple levels
		// under the same logical badge family (e.g. level 1-5 of a streak).
		tier: integer("tier"),

		unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("userAchievement_userId_idx").on(table.userId),
		index("userAchievement_achievement_idx").on(
			table.userId,
			table.achievementId,
		),
	],
);

// Compact, denormalized per‑user stats that the achievements engine uses as its
// primary source of truth when deciding which badges to unlock. This keeps
// evaluation fast while still allowing a full recompute from bookmarks/follows
// when needed.
export const userAchievementStats = pgTable("user_achievement_stats", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),

	// Aggregate counters
	totalBookmarks: integer("total_bookmarks").notNull().default(0),
	totalReadBookmarks: integer("total_read_bookmarks").notNull().default(0),
	totalFavoriteBookmarks: integer("total_favorite_bookmarks")
		.notNull()
		.default(0),
	totalPublicCollections: integer("total_public_collections")
		.notNull()
		.default(0),
	totalFollowers: integer("total_followers").notNull().default(0),
	totalFollowedCollections: integer("total_followed_collections")
		.notNull()
		.default(0),

	// Streak tracking
	currentDailyStreak: integer("current_daily_streak").notNull().default(0),
	longestDailyStreak: integer("longest_daily_streak").notNull().default(0),
	lastActivityDate: timestamp("last_activity_date"),

	// XP and level progression (coarse, engine maintains invariants)
	totalXp: integer("total_xp").notNull().default(0),
	level: integer("level").notNull().default(1),

	// Optional JSON payload for future extension without schema churn. This
	// should remain small (avoid raw event logs here).
	extra: jsonb("extra").$type<Record<string, unknown>>(),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const userAchievementRelations = relations(
	userAchievement,
	({ one }) => ({
		user: one(user, {
			fields: [userAchievement.userId],
			references: [user.id],
		}),
	}),
);

export const achievementDefinitionRelations = relations(
	achievementDefinition,
	() => ({}),
);

export const userAchievementStatsRelations = relations(
	userAchievementStats,
	({ one }) => ({
		user: one(user, {
			fields: [userAchievementStats.userId],
			references: [user.id],
		}),
	}),
);
