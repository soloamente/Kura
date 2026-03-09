import { db } from "@Kura/db";
import { bookmark } from "@Kura/db/schema/bookmarks";
import { google } from "@ai-sdk/google";
import { tasks } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";
import { and, eq, lt } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./middleware/auth";
import type { enrichBookmark } from "./trigger/enrich-bookmark";

export const bookmarksRouter = new Elysia({ prefix: "/bookmarks" })
	.use(authMiddleware)

	// ─── GET all (non-trashed) ────────────────────────────────────────────────
	.get("/", async ({ user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		return db.query.bookmark.findMany({
			where: and(eq(bookmark.userId, user.id), eq(bookmark.isTrashed, false)),
			with: { collection: true, tags: { with: { tag: true } } },
			orderBy: (bookmark, { desc }) => [desc(bookmark.createdAt)],
		});
	})

	// ─── GET trash ────────────────────────────────────────────────────────────
	.get("/trash", async ({ user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		return db.query.bookmark.findMany({
			where: and(eq(bookmark.userId, user.id), eq(bookmark.isTrashed, true)),
			with: { collection: true },
			orderBy: (bookmark, { desc }) => [desc(bookmark.trashedAt)],
		});
	})

	// ─── POST create (with duplicate check) ──────────────────────────────────
	.post(
		"/",
		async ({ body, user, set }) => {
			if (!user) {
				set.status = 401;
				return { message: "Unauthorized" };
			}

			const existing = await db.query.bookmark.findFirst({
				where: and(eq(bookmark.userId, user.id), eq(bookmark.url, body.url)),
			});

			if (existing) {
				set.status = 409;
				return { duplicate: true, bookmark: existing };
			}

			const [newBookmark] = await db
				.insert(bookmark)
				.values({
					id: crypto.randomUUID(),
					userId: user.id,
					url: body.url,
					collectionId: body.collectionId ?? null,
					title: body.url,
				})
				.returning();

			// fire enrichment in background — don't block the response
			tasks
				.trigger<typeof enrichBookmark>("enrich-bookmark", {
					bookmarkId: newBookmark.id,
					userId: user.id,
					url: newBookmark.url,
				})
				.catch((err) => console.error("Failed to trigger enrichment:", err));

			return newBookmark;
		},
		{
			body: t.Object({
				url: t.String(),
				collectionId: t.Optional(t.Nullable(t.String())),
			}),
		},
	)

	// ─── POST force create (skip duplicate check) ─────────────────────────────
	.post(
		"/force",
		async ({ body, user, set }) => {
			if (!user) {
				set.status = 401;
				return { message: "Unauthorized" };
			}

			const [newBookmark] = await db
				.insert(bookmark)
				.values({
					id: crypto.randomUUID(),
					userId: user.id,
					url: body.url,
					collectionId: body.collectionId ?? null,
					title: body.url,
				})
				.returning();

			// fire enrichment in background
			tasks
				.trigger<typeof enrichBookmark>("enrich-bookmark", {
					bookmarkId: newBookmark.id,
					userId: user.id,
					url: newBookmark.url,
				})
				.catch((err) => console.error("Failed to trigger enrichment:", err));

			return newBookmark;
		},
		{
			body: t.Object({
				url: t.String(),
				collectionId: t.Optional(t.Nullable(t.String())),
			}),
		},
	)

	// ─── PATCH trash (soft delete) ────────────────────────────────────────────
	.patch("/:id/trash", async ({ params, user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const [updated] = await db
			.update(bookmark)
			.set({ isTrashed: true, trashedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)))
			.returning();

		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		return updated;
	})

	// ─── PATCH restore from trash ─────────────────────────────────────────────
	.patch("/:id/restore", async ({ params, user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const [updated] = await db
			.update(bookmark)
			.set({ isTrashed: false, trashedAt: null, updatedAt: new Date() })
			.where(and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)))
			.returning();

		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		return updated;
	})

	// ─── DELETE hard delete (permanent) ──────────────────────────────────────
	.delete("/:id", async ({ params, user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const [deleted] = await db
			.delete(bookmark)
			.where(and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)))
			.returning();

		if (!deleted) {
			set.status = 404;
			return { message: "Not found" };
		}
		return { success: true };
	})

	// ─── DELETE purge old trash (7 days) ─────────────────────────────────────
	.delete("/trash/purge", async ({ user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const deleted = await db
			.delete(bookmark)
			.where(
				and(
					eq(bookmark.userId, user.id),
					eq(bookmark.isTrashed, true),
					lt(bookmark.trashedAt, sevenDaysAgo),
				),
			)
			.returning();

		return { purged: deleted.length };
	})

	.patch("/:id/read", async ({ params, user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}
		const [updated] = await db
			.update(bookmark)
			.set({ isRead: true, updatedAt: new Date() })
			.where(and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)))
			.returning();
		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		return updated;
	})
	.patch("/:id/unread", async ({ params, user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}
		const [updated] = await db
			.update(bookmark)
			.set({ isRead: false, updatedAt: new Date() })
			.where(and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)))
			.returning();
		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		return updated;
	})
	.patch("/:id/favorite", async ({ params, user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}
		const existing = await db.query.bookmark.findFirst({
			where: and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Not found" };
		}
		const [updated] = await db
			.update(bookmark)
			.set({ isFavorite: !existing.isFavorite, updatedAt: new Date() })
			.where(and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)))
			.returning();
		return updated;
	})

	// ─── POST generate title ──────────────────────────────────────────────────
	.post("/:id/generate-title", async ({ params, user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		const existing = await db.query.bookmark.findFirst({
			where: and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)),
		});

		if (!existing) {
			set.status = 404;
			return { message: "Not found" };
		}

		let pageContent = existing.url;
		try {
			const res = await fetch(existing.url, {
				signal: AbortSignal.timeout(5000),
			});
			const html = await res.text();
			const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
			const descMatch = html.match(
				/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
			);
			pageContent = `URL: ${existing.url}\nTitle tag: ${titleMatch?.[1] ?? ""}\nDescription: ${descMatch?.[1] ?? ""}`;
		} catch {
			// fallback to URL
		}

		const { text } = await generateText({
			model: google("gemini-2.5-flash"),
			providerOptions: {
				google: { thinkingConfig: { thinkingBudget: 0 } },
			},
			prompt: `Generate a short, clean bookmark title (max 60 chars, no quotes) for this page:\n\n${pageContent}\n\nRespond with ONLY the title, nothing else.`,
		});

		const raw = text.trim().replace(/^["']|["']$/g, "");
		const title =
			raw
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.at(-1) ?? raw;

		const [updated] = await db
			.update(bookmark)
			.set({ title, updatedAt: new Date() })
			.where(and(eq(bookmark.id, params.id), eq(bookmark.userId, user.id)))
			.returning();

		return updated;
	});
