export type BadgeCelebrationLevel = "subtle" | "rare" | "epic";

export interface UnlockableBadge {
	id: string;
	isUnlocked: boolean;
	celebration: BadgeCelebrationLevel;
}

export interface BadgeCelebrationVisuals {
	scale: number;
	glowOpacity: number;
	burstCount: number;
	durationMs: number;
}

export function getNewlyUnlockedBadges<T extends UnlockableBadge>(
	catalog: T[],
	seenUnlockedIds: Set<string>,
): T[] {
	return catalog.filter(
		(badge) => badge.isUnlocked && !seenUnlockedIds.has(badge.id),
	);
}

// Tuned so subtle feels quick and light, rare has noticeable drama,
// and epic feels genuinely rewarding with bigger bursts and longer glow.
export function getBadgeCelebrationVisuals(
	level: BadgeCelebrationLevel,
): BadgeCelebrationVisuals {
	switch (level) {
		case "subtle":
			return {
				scale: 1.05,
				glowOpacity: 0.2,
				burstCount: 4,
				durationMs: 700,
			};
		case "rare":
			return {
				scale: 1.12,
				glowOpacity: 0.32,
				burstCount: 6,
				durationMs: 950,
			};
		case "epic":
			return {
				scale: 1.22,
				glowOpacity: 0.45,
				burstCount: 10,
				durationMs: 1400,
			};
	}
}
