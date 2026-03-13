import { db } from "@Kura/db";
import {
	achievementDefinition,
	userAchievement,
	userAchievementStats,
} from "@Kura/db/schema/achievements";
import { user } from "@Kura/db/schema/auth";
import {
	bookmark,
	collection,
	collectionFollow,
	userFollow,
} from "@Kura/db/schema/bookmarks";
import { and, asc, eq } from "drizzle-orm";
import { DEFAULT_ACHIEVEMENT_DEFINITIONS } from "./achievement-defaults";
import {
	type AchievementRule,
	evaluateAchievementRule,
	parseAchievementRule,
} from "./achievement-rules";

type UserAchievement = typeof userAchievement.$inferSelect;
type UserAchievementInsert = typeof userAchievement.$inferInsert;
type UserAchievementStats = typeof userAchievementStats.$inferSelect;
type AchievementDefinitionRow = typeof achievementDefinition.$inferSelect;
type AchievementDefinitionInsert = typeof achievementDefinition.$inferInsert;
export type BadgeCelebrationLevel = "subtle" | "rare" | "epic";

export type ActivityType =
	| "bookmark_created"
	| "bookmark_read"
	| "bookmark_unread"
	| "bookmark_favorited"
	| "bookmark_unfavorited"
	| "follower_added"
	| "follower_removed"
	| "collection_followed"
	| "collection_unfollowed";

export interface RuntimeAchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	xp: number;
	tier: number | null;
	sortOrder: number;
	isDiscoverable: boolean;
	isActive: boolean;
	isArchived: boolean;
	celebration: BadgeCelebrationLevel;
	rule: AchievementRule;
}

export interface AchievementCatalogEntry extends RuntimeAchievementDefinition {
	current: number;
	target: number;
	progress: number;
	isUnlocked: boolean;
	unlockedAt: string | null;
}

export interface BadgesPayload {
	catalog: AchievementCatalogEntry[];
	stats: UserAchievementStats;
	unlocked: Array<{
		id: string;
		name: string;
		description: string;
		icon: string;
		xp: number;
		celebration: BadgeCelebrationLevel;
		tier?: number;
		unlockedAt: string;
	}>;
}

function toRuntimeAchievementDefinition(
	definition: AchievementDefinitionRow,
): RuntimeAchievementDefinition {
	return {
		...definition,
		rule: parseAchievementRule(definition.rule),
	};
}

function toAchievementDefinitionInsert(
	definition: (typeof DEFAULT_ACHIEVEMENT_DEFINITIONS)[number],
): AchievementDefinitionInsert {
	return {
		id: definition.id,
		name: definition.name,
		description: definition.description,
		icon: definition.icon,
		xp: definition.xp,
		tier: definition.tier ?? null,
		sortOrder: definition.sortOrder,
		isDiscoverable: definition.isDiscoverable,
		isActive: true,
		isArchived: false,
		celebration: definition.celebration,
		rule: definition.rule,
	};
}

export async function syncDefaultAchievementDefinitions() {
	for (const definition of DEFAULT_ACHIEVEMENT_DEFINITIONS) {
		const values = toAchievementDefinitionInsert(definition);
		const existing = await db.query.achievementDefinition.findFirst({
			where: eq(achievementDefinition.id, definition.id),
			columns: { id: true },
		});

		if (existing) {
			await db
				.update(achievementDefinition)
				.set({
					name: values.name,
					description: values.description,
					icon: values.icon,
					xp: values.xp,
					tier: values.tier,
					sortOrder: values.sortOrder,
					isDiscoverable: values.isDiscoverable,
					celebration: values.celebration,
					rule: values.rule,
					updatedAt: new Date(),
				})
				.where(eq(achievementDefinition.id, definition.id));
			continue;
		}

		await db.insert(achievementDefinition).values(values);
	}
}

export async function listAchievementDefinitions(options?: {
	includeInactive?: boolean;
	includeArchived?: boolean;
}) {
	await syncDefaultAchievementDefinitions();

	const definitions = await db.query.achievementDefinition.findMany({
		orderBy: [
			asc(achievementDefinition.sortOrder),
			asc(achievementDefinition.id),
		],
	});

	return definitions
		.filter((definition) =>
			options?.includeArchived ? true : definition.isArchived === false,
		)
		.filter((definition) =>
			options?.includeInactive ? true : definition.isActive === true,
		)
		.map((definition) => toRuntimeAchievementDefinition(definition));
}

export function calculateLevel(totalXp: number): number {
	return Math.max(1, Math.floor(totalXp / 100) + 1);
}

function toDateKey(date: Date): string {
	return [
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	].join("-");
}

export function applyDailyStreak(
	stats: UserAchievementStats,
	now: Date,
): Pick<
	UserAchievementStats,
	"currentDailyStreak" | "longestDailyStreak" | "lastActivityDate"
> {
	if (!stats.lastActivityDate) {
		return {
			currentDailyStreak: 1,
			longestDailyStreak: Math.max(1, stats.longestDailyStreak),
			lastActivityDate: now,
		};
	}

	const lastDateKey = toDateKey(stats.lastActivityDate);
	const nowDateKey = toDateKey(now);

	if (lastDateKey === nowDateKey) {
		return {
			currentDailyStreak: stats.currentDailyStreak,
			longestDailyStreak: stats.longestDailyStreak,
			lastActivityDate: now,
		};
	}

	const lastUtcDate = Date.UTC(
		stats.lastActivityDate.getUTCFullYear(),
		stats.lastActivityDate.getUTCMonth(),
		stats.lastActivityDate.getUTCDate(),
	);
	const nowUtcDate = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	const diffDays = Math.floor(
		(nowUtcDate - lastUtcDate) / (1000 * 60 * 60 * 24),
	);
	const currentDailyStreak = diffDays === 1 ? stats.currentDailyStreak + 1 : 1;

	return {
		currentDailyStreak,
		longestDailyStreak: Math.max(stats.longestDailyStreak, currentDailyStreak),
		lastActivityDate: now,
	};
}

export function evaluateUnlocks(
	stats: UserAchievementStats,
	existingAchievements: UserAchievement[],
	definitions: RuntimeAchievementDefinition[],
): RuntimeAchievementDefinition[] {
	const unlockedIds = new Set(
		existingAchievements.map((achievement) => achievement.achievementId),
	);

	return definitions.filter((definition) => {
		if (unlockedIds.has(definition.id)) return false;
		return (
			evaluateAchievementRule(stats, definition.rule) >=
			definition.rule.threshold
		);
	});
}

// Helper to fetch or initialize the stats row for a user so engine callers
// don't need to repeat the same upsert pattern.
export async function getOrCreateStats(userId: string) {
	const existing = await db.query.userAchievementStats.findFirst({
		where: eq(userAchievementStats.userId, userId),
	});
	if (existing) return existing;

	const [created] = await db
		.insert(userAchievementStats)
		.values({ userId })
		.returning();
	if (!created) {
		throw new Error(
			`Failed to initialize achievement stats for user ${userId}`,
		);
	}
	return created;
}

async function unlockAchievements(
	userId: string,
	stats: UserAchievementStats,
	now: Date,
): Promise<UserAchievementStats> {
	const existingAchievements = await db.query.userAchievement.findMany({
		where: eq(userAchievement.userId, userId),
	});
	const definitions = await listAchievementDefinitions();
	const pendingDefinitions = evaluateUnlocks(
		stats,
		existingAchievements,
		definitions,
	);

	if (pendingDefinitions.length === 0) {
		return stats;
	}

	await db.insert(userAchievement).values(
		pendingDefinitions.map(
			(definition): UserAchievementInsert => ({
				id: crypto.randomUUID(),
				userId,
				achievementId: definition.id,
				kind: definition.rule.metric,
				xpAwarded: definition.xp,
				tier: definition.tier,
				unlockedAt: now,
				createdAt: now,
			}),
		),
	);

	const earnedXp = pendingDefinitions.reduce(
		(sum, definition) => sum + definition.xp,
		0,
	);
	const totalXp = stats.totalXp + earnedXp;
	const level = calculateLevel(totalXp);

	const [updatedStats] = await db
		.update(userAchievementStats)
		.set({
			totalXp,
			level,
			updatedAt: now,
		})
		.where(eq(userAchievementStats.userId, userId))
		.returning();

	return updatedStats ?? { ...stats, totalXp, level, updatedAt: now };
}

// Recompute stats for a user from authoritative tables. This is used both for
// the initial backfill and as a repair path if counters ever drift.
export async function recomputeStatsForUser(userId: string) {
	const owner = await db.query.user.findFirst({
		where: eq(user.id, userId),
		columns: { id: true },
	});
	if (!owner) return null;

	const [
		totalBookmarks,
		totalReadBookmarks,
		totalFavoriteBookmarks,
		totalPublicCollections,
	] = await Promise.all([
		db.$count(
			bookmark,
			and(eq(bookmark.userId, userId), eq(bookmark.isTrashed, false)),
		),
		db.$count(
			bookmark,
			and(
				eq(bookmark.userId, userId),
				eq(bookmark.isTrashed, false),
				eq(bookmark.isRead, true),
			),
		),
		db.$count(
			bookmark,
			and(
				eq(bookmark.userId, userId),
				eq(bookmark.isTrashed, false),
				eq(bookmark.isFavorite, true),
			),
		),
		db.$count(
			collection,
			and(
				eq(collection.userId, userId),
				eq(collection.visibility, "public"),
				eq(collection.isTrashed, false),
			),
		),
	]);

	const [totalFollowers, totalFollowedCollections] = await Promise.all([
		db.$count(userFollow, eq(userFollow.followingId, userId)),
		db.$count(collectionFollow, eq(collectionFollow.followerId, userId)),
	]);

	const existingStats = await getOrCreateStats(userId);
	const [updatedStats] = await db
		.update(userAchievementStats)
		.set({
			totalBookmarks,
			totalReadBookmarks,
			totalFavoriteBookmarks,
			totalPublicCollections,
			totalFollowers,
			totalFollowedCollections,
			updatedAt: new Date(),
		})
		.where(eq(userAchievementStats.userId, userId))
		.returning();

	return unlockAchievements(userId, updatedStats ?? existingStats, new Date());
}

export async function recordActivityAndEvaluate(
	userId: string,
	activity: ActivityType,
	now = new Date(),
) {
	const stats = await getOrCreateStats(userId);
	const streakUpdate = applyDailyStreak(stats, now);

	let totalBookmarks = stats.totalBookmarks;
	let totalReadBookmarks = stats.totalReadBookmarks;
	let totalFavoriteBookmarks = stats.totalFavoriteBookmarks;
	let totalFollowers = stats.totalFollowers;
	let totalFollowedCollections = stats.totalFollowedCollections;

	switch (activity) {
		case "bookmark_created":
			totalBookmarks += 1;
			break;
		case "bookmark_read":
			totalReadBookmarks += 1;
			break;
		case "bookmark_unread":
			totalReadBookmarks = Math.max(0, totalReadBookmarks - 1);
			break;
		case "bookmark_favorited":
			totalFavoriteBookmarks += 1;
			break;
		case "bookmark_unfavorited":
			totalFavoriteBookmarks = Math.max(0, totalFavoriteBookmarks - 1);
			break;
		case "follower_added":
			totalFollowers += 1;
			break;
		case "follower_removed":
			totalFollowers = Math.max(0, totalFollowers - 1);
			break;
		case "collection_followed":
			totalFollowedCollections += 1;
			break;
		case "collection_unfollowed":
			totalFollowedCollections = Math.max(0, totalFollowedCollections - 1);
			break;
	}

	const [updatedStats] = await db
		.update(userAchievementStats)
		.set({
			totalBookmarks,
			totalReadBookmarks,
			totalFavoriteBookmarks,
			totalFollowers,
			totalFollowedCollections,
			currentDailyStreak: streakUpdate.currentDailyStreak,
			longestDailyStreak: streakUpdate.longestDailyStreak,
			lastActivityDate: streakUpdate.lastActivityDate,
			updatedAt: now,
		})
		.where(eq(userAchievementStats.userId, userId))
		.returning();

	return unlockAchievements(
		userId,
		updatedStats ?? {
			...stats,
			totalBookmarks,
			totalReadBookmarks,
			totalFavoriteBookmarks,
			totalFollowers,
			totalFollowedCollections,
			...streakUpdate,
			updatedAt: now,
		},
		now,
	);
}

export async function getBadgesPayloadForUser(
	userId: string,
): Promise<BadgesPayload | null> {
	const stats = await recomputeStatsForUser(userId);
	if (!stats) return null;
	const definitions = await listAchievementDefinitions();

	const unlocked = await db.query.userAchievement.findMany({
		where: eq(userAchievement.userId, userId),
		orderBy: (achievement, { asc }) => [asc(achievement.createdAt)],
	});
	const unlockedById = new Map(
		unlocked.map((achievement) => [achievement.achievementId, achievement]),
	);

	const catalog = definitions.map((definition) => {
		const unlockedEntry = unlockedById.get(definition.id);
		const current = evaluateAchievementRule(stats, definition.rule);
		return {
			...definition,
			current,
			target: definition.rule.threshold,
			progress: Math.max(0, Math.min(1, current / definition.rule.threshold)),
			isUnlocked: Boolean(unlockedEntry),
			unlockedAt: unlockedEntry?.unlockedAt.toISOString() ?? null,
		};
	});

	return {
		catalog,
		stats,
		unlocked: catalog
			.filter((entry) => entry.isUnlocked)
			.map((entry) => ({
				id: entry.id,
				name: entry.name,
				description: entry.description,
				icon: entry.icon,
				xp: entry.xp,
				celebration: entry.celebration,
				tier: entry.tier ?? undefined,
				unlockedAt: entry.unlockedAt ?? new Date().toISOString(),
			})),
	};
}

export async function getPublicBadgesForUser(userId: string) {
	const payload = await getBadgesPayloadForUser(userId);
	if (!payload) return [];

	return payload.unlocked.map((entry) => ({
		id: entry.id,
		name: entry.name,
		description: entry.description,
		icon: entry.icon,
		xp: entry.xp,
		celebration: entry.celebration,
		tier: entry.tier,
		unlockedAt: entry.unlockedAt,
	}));
}
