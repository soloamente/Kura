export type BadgeCelebrationLevel = "subtle" | "rare" | "epic";

export interface BadgeIconMotionConfig {
	animate: {
		scale: [number, number, number];
		rotate: [number, number, number];
		opacity: number;
	};
	transition: {
		type: "tween";
		duration: number;
		ease: "easeOut";
		times: [number, number, number];
	};
}

// Motion only supports two keyframes with spring transitions, so the
// three-step badge icon entrance uses a tween while preserving the same feel.
// Tuned with a more dramatic overshoot for epic, snappier settle for subtle.
export function getBadgeIconMotion(
	level: BadgeCelebrationLevel,
	scalePeak: number,
): BadgeIconMotionConfig {
	const duration = level === "epic" ? 0.58 : level === "rare" ? 0.48 : 0.36;

	// Epic gets a bigger initial rotation swing for more visual drama
	const rotateStart = level === "epic" ? -12 : -8;
	const rotateMid = level === "epic" ? 6 : 4;

	return {
		animate: {
			scale: [0.6, scalePeak, 1],
			rotate: [rotateStart, rotateMid, 0],
			opacity: 1,
		},
		transition: {
			type: "tween",
			duration,
			ease: "easeOut",
			times: [0, 0.55, 1],
		},
	};
}
