import { describe, expect, test } from "bun:test";
import { getBadgeIconMotion } from "./toast-motion";

describe("badge toast motion", () => {
	test("uses a non-spring transition for multi-keyframe icon animation", () => {
		const motion = getBadgeIconMotion("subtle", 1.03);

		expect(motion.animate.scale).toEqual([0.7, 1.03, 1]);
		expect(motion.animate.rotate).toEqual([-8, 4, 0]);
		expect(motion.transition.type).not.toBe("spring");
	});
});
