import { describe, expect, test } from "bun:test";
import { DEFAULT_ACHIEVEMENT_DEFINITIONS } from "./achievement-defaults";
import { parseAchievementRule } from "./achievement-rules";
import {
	applyDailyStreak,
	calculateLevel,
	evaluateUnlocks,
} from "./achievements";

function makeStats(
	overrides: Partial<Parameters<typeof evaluateUnlocks>[0]> = {},
) {
	return {
		userId: "user_1",
		totalBookmarks: 0,
		totalReadBookmarks: 0,
		totalFavoriteBookmarks: 0,
		totalPublicCollections: 0,
		totalFollowers: 0,
		totalFollowedCollections: 0,
		currentDailyStreak: 0,
		longestDailyStreak: 0,
		lastActivityDate: null,
		totalXp: 0,
		level: 1,
		extra: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

describe("achievements engine", () => {
	test("evaluateUnlocks returns bookmark and favorite badges once thresholds are met", () => {
		const definitions = DEFAULT_ACHIEVEMENT_DEFINITIONS.map((definition) => ({
			...definition,
			tier: definition.tier ?? null,
			isActive: true,
			isArchived: false,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			rule: parseAchievementRule(definition.rule),
		}));
		const unlocks = evaluateUnlocks(
			makeStats({
				totalBookmarks: 12,
				totalFavoriteBookmarks: 1,
			}),
			[],
			definitions,
		);

		expect(unlocks.map((unlock) => unlock.id)).toEqual([
			"first_bookmark",
			"bookmarks_10",
			"first_favorite",
		]);
	});

	test("evaluateUnlocks excludes badges that are already unlocked", () => {
		const definitions = DEFAULT_ACHIEVEMENT_DEFINITIONS.map((definition) => ({
			...definition,
			tier: definition.tier ?? null,
			isActive: true,
			isArchived: false,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			rule: parseAchievementRule(definition.rule),
		}));
		const unlocks = evaluateUnlocks(
			makeStats({
				totalBookmarks: 12,
			}),
			[
				{
					id: "ua_1",
					userId: "user_1",
					achievementId: "first_bookmark",
					kind: "bookmarks_total",
					xpAwarded: 10,
					tier: null,
					unlockedAt: new Date("2026-01-01T00:00:00.000Z"),
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
				},
			],
			definitions,
		);

		expect(unlocks.map((unlock) => unlock.id)).toEqual(["bookmarks_10"]);
	});

	test("applyDailyStreak increments on the next day and resets after a gap", () => {
		const first = applyDailyStreak(
			makeStats({
				currentDailyStreak: 2,
				longestDailyStreak: 2,
				lastActivityDate: new Date("2026-01-02T12:00:00.000Z"),
			}),
			new Date("2026-01-03T08:00:00.000Z"),
		);
		expect(first.currentDailyStreak).toBe(3);
		expect(first.longestDailyStreak).toBe(3);

		const reset = applyDailyStreak(
			makeStats({
				currentDailyStreak: 3,
				longestDailyStreak: 3,
				lastActivityDate: new Date("2026-01-03T12:00:00.000Z"),
			}),
			new Date("2026-01-06T08:00:00.000Z"),
		);
		expect(reset.currentDailyStreak).toBe(1);
		expect(reset.longestDailyStreak).toBe(3);
	});

	test("calculateLevel uses a simple 100 xp step curve", () => {
		expect(calculateLevel(0)).toBe(1);
		expect(calculateLevel(99)).toBe(1);
		expect(calculateLevel(100)).toBe(2);
		expect(calculateLevel(250)).toBe(3);
	});
});
