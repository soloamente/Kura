import { db } from "@Kura/db";
import { user } from "@Kura/db/schema/auth";
import { task } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import { recomputeStatsForUser } from "../achievements";

interface RecomputeAchievementsPayload {
	userId?: string;
}

export const recomputeAchievements = task({
	id: "recompute-achievements",
	maxDuration: 120,
	run: async (payload: RecomputeAchievementsPayload) => {
		// Support both targeted recomputes and a simple all-users backfill path.
		const targetUsers = payload.userId
			? await db.query.user.findMany({
					where: eq(user.id, payload.userId),
					columns: { id: true },
				})
			: await db.query.user.findMany({
					columns: { id: true },
				});

		let processed = 0;
		for (const target of targetUsers) {
			await recomputeStatsForUser(target.id);
			processed += 1;
		}

		console.log(`Recomputed achievements for ${processed} user(s)`);

		return {
			processed,
			scope: payload.userId ? "single_user" : "all_users",
		};
	},
});
