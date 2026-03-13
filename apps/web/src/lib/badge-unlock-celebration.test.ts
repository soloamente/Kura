import { describe, expect, test } from "bun:test";
import {
	getBadgeCelebrationVisuals,
	getNewlyUnlockedBadges,
} from "./badge-unlock-celebration";

describe("badge unlock celebration helpers", () => {
	test("returns only newly unlocked badges", () => {
		const newlyUnlocked = getNewlyUnlockedBadges(
			[
				{ id: "first_bookmark", isUnlocked: true, celebration: "subtle" },
				{ id: "followers_10", isUnlocked: true, celebration: "epic" },
				{ id: "bookmarks_10", isUnlocked: false, celebration: "rare" },
			],
			new Set(["first_bookmark"]),
		);

		expect(newlyUnlocked).toEqual([
			{ id: "followers_10", isUnlocked: true, celebration: "epic" },
		]);
	});

	test("epic visuals are stronger than subtle visuals", () => {
		const subtle = getBadgeCelebrationVisuals("subtle");
		const epic = getBadgeCelebrationVisuals("epic");

		expect(epic.scale).toBeGreaterThan(subtle.scale);
		expect(epic.glowOpacity).toBeGreaterThan(subtle.glowOpacity);
		expect(epic.burstCount).toBeGreaterThan(subtle.burstCount);
	});
});
