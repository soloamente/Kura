import { schedules } from "@trigger.dev/sdk/v3";
import { db } from "@Kura/db";
import { bookmark, collection } from "@Kura/db/schema/bookmarks";
import { and, eq, lt, isNotNull } from "drizzle-orm";

export const purgeTrash = schedules.task({
	id: "purge-trash",
	// runs every day at 3am UTC
	cron: "0 3 * * *",
	maxDuration: 60,
	run: async () => {
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		// ── hard-delete trashed bookmarks older than 7 days ──────────────────
		const deletedBookmarks = await db
			.delete(bookmark)
			.where(
				and(
					eq(bookmark.isTrashed, true),
					isNotNull(bookmark.trashedAt),
					lt(bookmark.trashedAt, sevenDaysAgo),
				),
			)
			.returning({ id: bookmark.id });

		// ── hard-delete trashed collections older than 7 days ────────────────
		// (their bookmarks were already soft-deleted and caught above)
		const deletedCollections = await db
			.delete(collection)
			.where(
				and(
					eq(collection.isTrashed, true),
					isNotNull(collection.trashedAt),
					lt(collection.trashedAt, sevenDaysAgo),
				),
			)
			.returning({ id: collection.id });

		console.log(
			`Purged ${deletedBookmarks.length} bookmarks and ${deletedCollections.length} collections from trash`,
		);

		return {
			purgedBookmarks: deletedBookmarks.length,
			purgedCollections: deletedCollections.length,
			olderThan: sevenDaysAgo.toISOString(),
		};
	},
});
