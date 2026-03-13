import { db } from "@Kura/db";
import { bookmark, collection } from "@Kura/db/schema/bookmarks";
import { and, eq, gte, lt, lte } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./middleware/auth";
import { getActiveUser } from "./middleware/auth-guards";

export const collectionsRouter = new Elysia({ prefix: "/collections" })
	.use(authMiddleware)

	// ─── GET all (non-trashed) ────────────────────────────────────────────────
	.get("/", async ({ user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		return db.query.collection.findMany({
			where: and(
				eq(collection.userId, user.id),
				eq(collection.isTrashed, false),
			),
			with: {
				bookmarks: {
					where: eq(bookmark.isTrashed, false),
				},
			},
			orderBy: (collection, { asc }) => [asc(collection.createdAt)],
		});
	})

	// ─── GET trashed collections ──────────────────────────────────────────────
	.get("/trash", async ({ user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		return db.query.collection.findMany({
			where: and(
				eq(collection.userId, user.id),
				eq(collection.isTrashed, true),
			),
			with: {
				bookmarks: {
					where: eq(bookmark.isTrashed, true),
				},
			},
			orderBy: (collection, { desc }) => [desc(collection.trashedAt)],
		});
	})

	// ─── POST create ──────────────────────────────────────────────────────────
	.post(
		"/",
		async ({ body, user, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const [newCollection] = await db
				.insert(collection)
				.values({
					id: crypto.randomUUID(),
					userId: activeUser.id,
					name: body.name,
				})
				.returning();

			return newCollection;
		},
		{ body: t.Object({ name: t.String() }) },
	)

	// ─── PATCH update (name + color) ─────────────────────────────────────────
	.patch(
		"/:id",
		async ({ params, body, user, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const [updated] = await db
				.update(collection)
				.set({
					...(body.name !== undefined && { name: body.name }),
					...(body.color !== undefined && { color: body.color }),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(collection.id, params.id),
						eq(collection.userId, activeUser.id),
					),
				)
				.returning();

			if (!updated) {
				set.status = 404;
				return { message: "Not found" };
			}

			return updated;
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				color: t.Optional(t.Nullable(t.String())),
			}),
		},
	)

	// ─── PATCH trash collection + its bookmarks (soft delete) ─────────────────
	.patch("/:id/trash", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const existing = await db.query.collection.findFirst({
			where: and(
				eq(collection.id, params.id),
				eq(collection.userId, activeUser.id),
			),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Not found" };
		}

		const now = new Date();

		// soft-delete the collection
		const [updated] = await db
			.update(collection)
			.set({ isTrashed: true, trashedAt: now, updatedAt: now })
			.where(
				and(eq(collection.id, params.id), eq(collection.userId, activeUser.id)),
			)
			.returning();

		// soft-delete all its non-trashed bookmarks
		await db
			.update(bookmark)
			.set({ isTrashed: true, trashedAt: now, updatedAt: now })
			.where(
				and(
					eq(bookmark.collectionId, params.id),
					eq(bookmark.userId, activeUser.id),
					eq(bookmark.isTrashed, false),
				),
			);

		return updated;
	})

	// ─── PATCH restore collection + its bookmarks ─────────────────────────────
	.patch("/:id/restore", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const existing = await db.query.collection.findFirst({
			where: and(
				eq(collection.id, params.id),
				eq(collection.userId, activeUser.id),
			),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Not found" };
		}
		if (!existing.trashedAt) {
			set.status = 400;
			return { message: "Not trashed" };
		}

		const now = new Date();

		// restore the collection
		const [restored] = await db
			.update(collection)
			.set({ isTrashed: false, trashedAt: null, updatedAt: now })
			.where(
				and(eq(collection.id, params.id), eq(collection.userId, activeUser.id)),
			)
			.returning();

		// restore only bookmarks that were trashed at the same time as the collection
		// (±2 second window so we don't accidentally restore unrelated trashed bookmarks)
		const windowStart = new Date(existing.trashedAt.getTime() - 2000);
		const windowEnd = new Date(existing.trashedAt.getTime() + 2000);

		await db
			.update(bookmark)
			.set({ isTrashed: false, trashedAt: null, updatedAt: now })
			.where(
				and(
					eq(bookmark.collectionId, params.id),
					eq(bookmark.userId, activeUser.id),
					eq(bookmark.isTrashed, true),
					gte(bookmark.trashedAt, windowStart),
					lte(bookmark.trashedAt, windowEnd),
				),
			);

		return restored;
	})

	// ─── DELETE hard delete collection (from trash, permanent) ──────────────
	.delete("/:id", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		// also hard-delete all its trashed bookmarks
		await db
			.delete(bookmark)
			.where(
				and(
					eq(bookmark.collectionId, params.id),
					eq(bookmark.userId, activeUser.id),
				),
			);

		const [deleted] = await db
			.delete(collection)
			.where(
				and(eq(collection.id, params.id), eq(collection.userId, activeUser.id)),
			)
			.returning();

		if (!deleted) {
			set.status = 404;
			return { message: "Not found" };
		}
		return { success: true };
	})

	// ─── DELETE collection only — keep bookmarks (detach) ────────────────────
	.delete("/:id/keep-bookmarks", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const existing = await db.query.collection.findFirst({
			where: and(
				eq(collection.id, params.id),
				eq(collection.userId, activeUser.id),
			),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Not found" };
		}

		// detach bookmarks (collectionId → null), leave them in library
		await db
			.update(bookmark)
			.set({ collectionId: null, updatedAt: new Date() })
			.where(
				and(
					eq(bookmark.collectionId, params.id),
					eq(bookmark.userId, activeUser.id),
				),
			);

		// hard delete — user explicitly chose to keep bookmarks, no recovery needed
		await db
			.delete(collection)
			.where(
				and(eq(collection.id, params.id), eq(collection.userId, activeUser.id)),
			);

		return { success: true };
	})

	// ─── PATCH update visibility ─────────────────────────────────────────────
	.patch(
		"/:id/visibility",
		async ({ params, body, user, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const [updated] = await db
				.update(collection)
				.set({ visibility: body.visibility, updatedAt: new Date() })
				.where(
					and(
						eq(collection.id, params.id),
						eq(collection.userId, activeUser.id),
					),
				)
				.returning();

			if (!updated) {
				set.status = 404;
				return { message: "Not found" };
			}

			return updated;
		},
		{
			body: t.Object({
				visibility: t.Union([
					t.Literal("private"),
					t.Literal("friends"),
					t.Literal("public"),
				]),
			}),
		},
	)

	// ─── DELETE purge old trashed collections (7 days) ───────────────────────
	.delete("/trash/purge", async ({ user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const deleted = await db
			.delete(collection)
			.where(
				and(
					eq(collection.userId, activeUser.id),
					eq(collection.isTrashed, true),
					lt(collection.trashedAt, sevenDaysAgo),
				),
			)
			.returning();

		return { purged: deleted.length };
	});
