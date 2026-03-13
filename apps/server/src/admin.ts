import { db } from "@Kura/db";
import {
	achievementDefinition,
	userAchievement,
} from "@Kura/db/schema/achievements";
import { adminActionLog, user } from "@Kura/db/schema/auth";
import { userFollow } from "@Kura/db/schema/bookmarks";
import { tasks } from "@trigger.dev/sdk/v3";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import {
	evaluateAchievementRule,
	parseAchievementRule,
} from "./achievement-rules";
import {
	getBadgesPayloadForUser,
	listAchievementDefinitions,
	recomputeStatsForUser,
	syncDefaultAchievementDefinitions,
} from "./achievements";
import { buildModerationUpdate } from "./admin-moderation";
import { authMiddleware } from "./middleware/auth";
import { getAdminUser } from "./middleware/auth-guards";
import type { recomputeAchievements } from "./trigger/recompute-achievements";

export const adminRouter = new Elysia({ prefix: "/admin" })
	.use(authMiddleware)
	.get("/me", async ({ user: me, set }) => {
		const adminUser = getAdminUser(me, set);
		if ("message" in adminUser) return adminUser;

		// The initial admin shell only needs enough data to prove route
		// protection works and to give the UI a small overview.
		const [userCount, unlockedAchievementCount] = await Promise.all([
			db.$count(user),
			db.$count(userAchievement),
		]);

		const fullAdmin = await db.query.user.findFirst({
			where: eq(user.id, adminUser.id),
			columns: {
				id: true,
				name: true,
				email: true,
				role: true,
				status: true,
			},
		});

		return {
			viewer: fullAdmin,
			stats: {
				userCount,
				unlockedAchievementCount,
			},
		};
	})
	.get(
		"/users",
		async ({ user: me, query, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const search = query.q?.trim();
			const filters = search
				? or(
						ilike(user.name, `%${search}%`),
						ilike(user.email, `%${search}%`),
						ilike(user.username, `%${search}%`),
					)
				: undefined;

			const users = await db.query.user.findMany({
				where: filters,
				columns: {
					id: true,
					name: true,
					email: true,
					username: true,
					image: true,
					role: true,
					status: true,
					bannedAt: true,
					createdAt: true,
				},
				orderBy: [desc(user.createdAt)],
				limit: 100,
			});

			return { users };
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
			}),
		},
	)
	.get("/users/:id", async ({ user: me, params, set }) => {
		const adminUser = getAdminUser(me, set);
		if ("message" in adminUser) return adminUser;

		const targetUser = await db.query.user.findFirst({
			where: eq(user.id, params.id),
			columns: {
				id: true,
				name: true,
				email: true,
				username: true,
				image: true,
				bio: true,
				role: true,
				status: true,
				bannedAt: true,
				banReason: true,
				bannedByUserId: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (!targetUser) {
			set.status = 404;
			return { message: "User not found" };
		}

		const [followerCount, followingCount, badgesPayload, moderationLog] =
			await Promise.all([
				db.$count(userFollow, eq(userFollow.followingId, targetUser.id)),
				db.$count(userFollow, eq(userFollow.followerId, targetUser.id)),
				getBadgesPayloadForUser(targetUser.id),
				db.query.adminActionLog.findMany({
					where: eq(adminActionLog.targetUserId, targetUser.id),
					orderBy: [desc(adminActionLog.createdAt)],
					limit: 20,
				}),
			]);

		const actingAdminIds = moderationLog
			.map((entry) => entry.adminUserId)
			.filter((entry): entry is string => Boolean(entry));
		const actingAdmins =
			actingAdminIds.length > 0
				? await db.query.user.findMany({
						where: inArray(user.id, actingAdminIds),
						columns: { id: true, name: true, email: true },
					})
				: [];
		const actingAdminMap = new Map(
			actingAdmins.map((actingAdmin) => [actingAdmin.id, actingAdmin]),
		);

		return {
			user: targetUser,
			social: {
				followerCount,
				followingCount,
			},
			badges: badgesPayload,
			moderationLog: moderationLog.map((entry) => ({
				...entry,
				admin: entry.adminUserId
					? (actingAdminMap.get(entry.adminUserId) ?? null)
					: null,
			})),
		};
	})
	.post(
		"/users/:id/ban",
		async ({ user: me, params, body, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const targetUser = await db.query.user.findFirst({
				where: eq(user.id, params.id),
			});

			if (!targetUser) {
				set.status = 404;
				return { message: "User not found" };
			}

			if (targetUser.status === "banned") {
				set.status = 409;
				return { message: "User is already banned" };
			}

			const now = new Date();
			const moderationUpdate = buildModerationUpdate({
				action: "ban",
				actorUserId: adminUser.id,
				targetUserId: targetUser.id,
				reason: body.reason ?? "",
				now,
			});

			if ("message" in moderationUpdate) {
				set.status = 400;
				return moderationUpdate;
			}

			const [updatedUser] = await db.transaction(async (tx) => {
				const updated = await tx
					.update(user)
					.set({
						...moderationUpdate.userPatch,
						updatedAt: now,
					})
					.where(eq(user.id, targetUser.id))
					.returning();

				await tx.insert(adminActionLog).values({
					id: crypto.randomUUID(),
					adminUserId: adminUser.id,
					targetUserId: targetUser.id,
					action: moderationUpdate.auditAction,
					reason: moderationUpdate.auditReason,
					createdAt: now,
				});

				return updated;
			});

			return { user: updatedUser };
		},
		{
			body: t.Object({
				reason: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/users/:id/unban",
		async ({ user: me, params, body, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const targetUser = await db.query.user.findFirst({
				where: eq(user.id, params.id),
			});

			if (!targetUser) {
				set.status = 404;
				return { message: "User not found" };
			}

			if (targetUser.status === "active") {
				set.status = 409;
				return { message: "User is not banned" };
			}

			const now = new Date();
			const moderationUpdate = buildModerationUpdate({
				action: "unban",
				actorUserId: adminUser.id,
				targetUserId: targetUser.id,
				reason: body.reason ?? "",
				now,
			});

			if ("message" in moderationUpdate) {
				set.status = 400;
				return moderationUpdate;
			}

			const [updatedUser] = await db.transaction(async (tx) => {
				const updated = await tx
					.update(user)
					.set({
						...moderationUpdate.userPatch,
						updatedAt: now,
					})
					.where(eq(user.id, targetUser.id))
					.returning();

				await tx.insert(adminActionLog).values({
					id: crypto.randomUUID(),
					adminUserId: adminUser.id,
					targetUserId: targetUser.id,
					action: moderationUpdate.auditAction,
					reason: moderationUpdate.auditReason,
					createdAt: now,
				});

				return updated;
			});

			return { user: updatedUser };
		},
		{
			body: t.Object({
				reason: t.Optional(t.String()),
			}),
		},
	)
	.get("/achievements", async ({ user: me, set }) => {
		const adminUser = getAdminUser(me, set);
		if ("message" in adminUser) return adminUser;

		const definitions = await listAchievementDefinitions({
			includeArchived: true,
			includeInactive: true,
		});

		return {
			achievements: definitions,
		};
	})
	.post(
		"/achievements",
		async ({ user: me, body, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const existing = await db.query.achievementDefinition.findFirst({
				where: eq(achievementDefinition.id, body.id),
				columns: { id: true },
			});

			if (existing) {
				set.status = 409;
				return { message: "Achievement id already exists" };
			}

			const parsedRule = parseAchievementRule(body.rule);
			const [created] = await db
				.insert(achievementDefinition)
				.values({
					id: body.id,
					name: body.name,
					description: body.description,
					icon: body.icon,
					xp: body.xp,
					tier: body.tier ?? null,
					sortOrder: body.sortOrder ?? 0,
					isDiscoverable: body.isDiscoverable ?? true,
					isActive: body.isActive ?? true,
					isArchived: body.isArchived ?? false,
					celebration: body.celebration,
					rule: parsedRule,
				})
				.returning();

			return {
				achievement: created,
			};
		},
		{
			body: t.Object({
				id: t.String(),
				name: t.String(),
				description: t.String(),
				icon: t.String(),
				xp: t.Integer(),
				tier: t.Optional(t.Nullable(t.Integer())),
				sortOrder: t.Optional(t.Integer()),
				isDiscoverable: t.Optional(t.Boolean()),
				isActive: t.Optional(t.Boolean()),
				isArchived: t.Optional(t.Boolean()),
				celebration: t.Union([
					t.Literal("subtle"),
					t.Literal("rare"),
					t.Literal("epic"),
				]),
				rule: t.Object({
					type: t.Literal("metric_threshold"),
					metric: t.Union([
						t.Literal("bookmarks_total"),
						t.Literal("bookmarks_read"),
						t.Literal("bookmarks_favorited"),
						t.Literal("public_collections"),
						t.Literal("followers_total"),
						t.Literal("followed_collections"),
						t.Literal("account_age"),
						t.Literal("daily_streak"),
						t.Literal("xp_level"),
					]),
					threshold: t.Integer(),
				}),
			}),
		},
	)
	.patch(
		"/achievements/:id",
		async ({ user: me, params, body, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const existing = await db.query.achievementDefinition.findFirst({
				where: eq(achievementDefinition.id, params.id),
			});

			if (!existing) {
				set.status = 404;
				return { message: "Achievement not found" };
			}

			const nextRule = body.rule
				? parseAchievementRule(body.rule)
				: existing.rule;
			const [updated] = await db
				.update(achievementDefinition)
				.set({
					...(body.name !== undefined && { name: body.name }),
					...(body.description !== undefined && {
						description: body.description,
					}),
					...(body.icon !== undefined && { icon: body.icon }),
					...(body.xp !== undefined && { xp: body.xp }),
					...(body.tier !== undefined && { tier: body.tier }),
					...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
					...(body.isDiscoverable !== undefined && {
						isDiscoverable: body.isDiscoverable,
					}),
					...(body.isActive !== undefined && { isActive: body.isActive }),
					...(body.isArchived !== undefined && { isArchived: body.isArchived }),
					...(body.celebration !== undefined && {
						celebration: body.celebration,
					}),
					rule: nextRule,
					updatedAt: new Date(),
				})
				.where(eq(achievementDefinition.id, params.id))
				.returning();

			return {
				achievement: updated,
			};
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				description: t.Optional(t.String()),
				icon: t.Optional(t.String()),
				xp: t.Optional(t.Integer()),
				tier: t.Optional(t.Nullable(t.Integer())),
				sortOrder: t.Optional(t.Integer()),
				isDiscoverable: t.Optional(t.Boolean()),
				isActive: t.Optional(t.Boolean()),
				isArchived: t.Optional(t.Boolean()),
				celebration: t.Optional(
					t.Union([t.Literal("subtle"), t.Literal("rare"), t.Literal("epic")]),
				),
				rule: t.Optional(
					t.Object({
						type: t.Literal("metric_threshold"),
						metric: t.Union([
							t.Literal("bookmarks_total"),
							t.Literal("bookmarks_read"),
							t.Literal("bookmarks_favorited"),
							t.Literal("public_collections"),
							t.Literal("followers_total"),
							t.Literal("followed_collections"),
							t.Literal("account_age"),
							t.Literal("daily_streak"),
							t.Literal("xp_level"),
						]),
						threshold: t.Integer(),
					}),
				),
			}),
		},
	)
	.post(
		"/achievements/:id/preview",
		async ({ user: me, params, body, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const definition = await db.query.achievementDefinition.findFirst({
				where: eq(achievementDefinition.id, params.id),
			});

			if (!definition) {
				set.status = 404;
				return { message: "Achievement not found" };
			}

			const stats = await recomputeStatsForUser(body.userId);
			if (!stats) {
				set.status = 404;
				return { message: "User not found" };
			}

			const unlockedEntry = await db.query.userAchievement.findFirst({
				where: and(
					eq(userAchievement.achievementId, params.id),
					eq(userAchievement.userId, body.userId),
				),
			});
			const parsedRule = parseAchievementRule(definition.rule);
			const current = evaluateAchievementRule(stats, parsedRule);

			return {
				preview: {
					current,
					target: parsedRule.threshold,
					progress: Math.max(0, Math.min(1, current / parsedRule.threshold)),
					isUnlocked: Boolean(unlockedEntry),
				},
			};
		},
		{
			body: t.Object({
				userId: t.String(),
			}),
		},
	)
	.post("/achievements/sync-defaults", async ({ user: me, set }) => {
		const adminUser = getAdminUser(me, set);
		if ("message" in adminUser) return adminUser;

		await syncDefaultAchievementDefinitions();
		const definitions = await listAchievementDefinitions({
			includeArchived: true,
			includeInactive: true,
		});

		return {
			synced: definitions.length,
		};
	})
	.post(
		"/achievements/reconcile",
		async ({ user: me, body, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			await syncDefaultAchievementDefinitions();
			const result = await tasks.trigger<typeof recomputeAchievements>(
				"recompute-achievements",
				{
					userId: body.userId ?? undefined,
				},
			);

			return {
				triggerId: result.id,
				scope: body.userId ? "single_user" : "all_users",
			};
		},
		{
			body: t.Object({
				userId: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/users/:id/achievements/:achievementId/grant",
		async ({ user: me, params, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const targetUser = await db.query.user.findFirst({
				where: eq(user.id, params.id),
				columns: { id: true },
			});

			if (!targetUser) {
				set.status = 404;
				return { message: "User not found" };
			}

			const definition = await db.query.achievementDefinition.findFirst({
				where: eq(achievementDefinition.id, params.achievementId),
			});

			if (!definition) {
				set.status = 404;
				return { message: "Achievement not found" };
			}

			const existing = await db.query.userAchievement.findFirst({
				where: and(
					eq(userAchievement.userId, targetUser.id),
					eq(userAchievement.achievementId, params.achievementId),
				),
			});

			if (existing) {
				set.status = 409;
				return { message: "Achievement already granted to this user" };
			}

			const now = new Date();
			// Recompute stats after the manual grant so XP/level and unlocks stay
			// consistent with the engine’s rules.
			await recomputeStatsForUser(targetUser.id);

			const [created] = await db
				.insert(userAchievement)
				.values({
					id: crypto.randomUUID(),
					userId: targetUser.id,
					achievementId: definition.id,
					kind: definition.rule.metric,
					xpAwarded: definition.xp,
					tier: definition.tier,
					unlockedAt: now,
					createdAt: now,
				})
				.returning();

			return {
				achievement: created,
			};
		},
	)
	.post(
		"/users/:id/achievements/:achievementId/revoke",
		async ({ user: me, params, set }) => {
			const adminUser = getAdminUser(me, set);
			if ("message" in adminUser) return adminUser;

			const targetUser = await db.query.user.findFirst({
				where: eq(user.id, params.id),
				columns: { id: true },
			});

			if (!targetUser) {
				set.status = 404;
				return { message: "User not found" };
			}

			const existing = await db
				.delete(userAchievement)
				.where(
					and(
						eq(userAchievement.userId, targetUser.id),
						eq(userAchievement.achievementId, params.achievementId),
					),
				)
				.returning();

			if (existing.length === 0) {
				set.status = 404;
				return { message: "Achievement not found for this user" };
			}

			// Recompute stats so XP/level reflect the remaining achievements.
			await recomputeStatsForUser(targetUser.id);

			return {
				revoked: true,
			};
		},
	);
