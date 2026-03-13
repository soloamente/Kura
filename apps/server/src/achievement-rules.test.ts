import { describe, expect, test } from "bun:test";
import {
	evaluateAchievementRule,
	parseAchievementRule,
} from "./achievement-rules";

const baseStats = {
	userId: "user_1",
	totalBookmarks: 12,
	totalReadBookmarks: 5,
	totalFavoriteBookmarks: 2,
	totalPublicCollections: 1,
	totalFollowers: 3,
	totalFollowedCollections: 4,
	currentDailyStreak: 2,
	longestDailyStreak: 2,
	lastActivityDate: null,
	totalXp: 40,
	level: 1,
	extra: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("achievement rules", () => {
	test("parses a metric threshold rule", () => {
		const result = parseAchievementRule({
			type: "metric_threshold",
			metric: "bookmarks_total",
			threshold: 10,
		});

		expect(result).toEqual({
			type: "metric_threshold",
			metric: "bookmarks_total",
			threshold: 10,
		});
	});

	test("rejects invalid thresholds", () => {
		expect(() =>
			parseAchievementRule({
				type: "metric_threshold",
				metric: "bookmarks_total",
				threshold: 0,
			}),
		).toThrow("Achievement rule threshold must be a positive integer");
	});

	test("evaluates the current metric for a valid rule", () => {
		const currentValue = evaluateAchievementRule(
			baseStats,
			parseAchievementRule({
				type: "metric_threshold",
				metric: "followed_collections",
				threshold: 3,
			}),
		);

		expect(currentValue).toBe(4);
	});
});
