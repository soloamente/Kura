import type { userAchievementStats } from "@Kura/db/schema/achievements";

type AchievementMetric =
	| "bookmarks_total"
	| "bookmarks_read"
	| "bookmarks_favorited"
	| "public_collections"
	| "followers_total"
	| "followed_collections"
	| "account_age"
	| "daily_streak"
	| "xp_level";
type AchievementStats = typeof userAchievementStats.$inferSelect;

const ACHIEVEMENT_METRICS: AchievementMetric[] = [
	"bookmarks_total",
	"bookmarks_read",
	"bookmarks_favorited",
	"public_collections",
	"followers_total",
	"followed_collections",
	"account_age",
	"daily_streak",
	"xp_level",
];

export interface MetricThresholdAchievementRule {
	type: "metric_threshold";
	metric: AchievementMetric;
	threshold: number;
}

export type AchievementRule = MetricThresholdAchievementRule;

export function parseAchievementRule(input: unknown): AchievementRule {
	if (typeof input !== "object" || input === null) {
		throw new Error("Achievement rule must be an object");
	}

	const maybeRule = input as {
		type?: unknown;
		metric?: unknown;
		threshold?: unknown;
	};

	if (maybeRule.type !== "metric_threshold") {
		throw new Error("Achievement rule type is not supported");
	}

	if (
		typeof maybeRule.metric !== "string" ||
		!ACHIEVEMENT_METRICS.includes(maybeRule.metric as AchievementMetric)
	) {
		throw new Error("Achievement rule metric is invalid");
	}

	if (
		typeof maybeRule.threshold !== "number" ||
		!Number.isInteger(maybeRule.threshold) ||
		maybeRule.threshold < 1
	) {
		throw new Error("Achievement rule threshold must be a positive integer");
	}

	return {
		type: "metric_threshold",
		metric: maybeRule.metric as AchievementMetric,
		threshold: maybeRule.threshold,
	};
}

export function evaluateAchievementRule(
	stats: AchievementStats,
	rule: AchievementRule,
): number {
	switch (rule.metric) {
		case "bookmarks_total":
			return stats.totalBookmarks;
		case "bookmarks_read":
			return stats.totalReadBookmarks;
		case "bookmarks_favorited":
			return stats.totalFavoriteBookmarks;
		case "public_collections":
			return stats.totalPublicCollections;
		case "followers_total":
			return stats.totalFollowers;
		case "followed_collections":
			return stats.totalFollowedCollections;
		case "daily_streak":
			return stats.currentDailyStreak;
		case "xp_level":
			return stats.level;
		case "account_age":
			return 0;
	}
}
