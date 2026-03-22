import { db } from "@Kura/db";
import { bookmark, bookmarkTag, tag } from "@Kura/db/schema/bookmarks";
import { google } from "@ai-sdk/google";
import { tasks } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";
import { and, eq, inArray, isNull, like, lt, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { recordActivityAndEvaluate } from "./achievements";
import { authMiddleware } from "./middleware/auth";
import { getActiveUser } from "./middleware/auth-guards";
import type { enrichBookmark } from "./trigger/enrich-bookmark";

/**
 * Elysia validates these with `t.Object`; `tsc` still sees `body` as `unknown`, so we
 * assert shapes that match the route schemas (same approach as `admin.ts`).
 */
interface CreateBookmarkBody {
	url: string;
	collectionId?: string | null;
}

interface MoveBookmarkBody {
	collectionId: string | null;
}

type BookmarkVisibility = "private" | "friends" | "public";

interface BookmarkVisibilityBody {
	visibility: BookmarkVisibility;
}

interface BookmarkTagsBody {
	tagIds: string[];
}

interface UpdateBookmarkBody {
	title?: string | null;
	description?: string | null;
}

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
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const payload = body as CreateBookmarkBody;

			const existing = await db.query.bookmark.findFirst({
				where: and(
					eq(bookmark.userId, activeUser.id),
					eq(bookmark.url, payload.url),
				),
			});

			if (existing) {
				set.status = 409;
				return { duplicate: true, bookmark: existing };
			}

			const inserted = await db
				.insert(bookmark)
				.values({
					id: crypto.randomUUID(),
					userId: activeUser.id,
					url: payload.url,
					collectionId: payload.collectionId ?? null,
					title: payload.url,
				})
				.returning();

			const newBookmark = inserted[0];
			if (!newBookmark) {
				set.status = 500;
				return { message: "Failed to create bookmark" };
			}

			// Update the achievements snapshot immediately so newly earned badges
			// can appear in the UI without waiting for a background reconcile.
			await recordActivityAndEvaluate(activeUser.id, "bookmark_created");

			// fire enrichment in background — don't block the response
			tasks
				.trigger<typeof enrichBookmark>("enrich-bookmark", {
					bookmarkId: newBookmark.id,
					userId: activeUser.id,
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
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const payload = body as CreateBookmarkBody;

			const inserted = await db
				.insert(bookmark)
				.values({
					id: crypto.randomUUID(),
					userId: activeUser.id,
					url: payload.url,
					collectionId: payload.collectionId ?? null,
					title: payload.url,
				})
				.returning();

			const newBookmark = inserted[0];
			if (!newBookmark) {
				set.status = 500;
				return { message: "Failed to create bookmark" };
			}

			// Force-create follows the same product flow as a normal save, so it
			// should count toward badge progression as well.
			await recordActivityAndEvaluate(activeUser.id, "bookmark_created");

			// fire enrichment in background
			tasks
				.trigger<typeof enrichBookmark>("enrich-bookmark", {
					bookmarkId: newBookmark.id,
					userId: activeUser.id,
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

	// ─── POST enrich-all (re-enrich unenriched bookmarks) ────────────────────
	.post("/enrich-all", async ({ user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		// Find non-trashed bookmarks that are missing enrichment data.
		// A bookmark is considered unenriched if its title is still the raw URL
		// placeholder (null or starts with "http") or if description/image/favicon
		// are absent.
		const unenriched = await db.query.bookmark.findMany({
			where: and(
				eq(bookmark.userId, activeUser.id),
				eq(bookmark.isTrashed, false),
				or(
					isNull(bookmark.title),
					like(bookmark.title, "http%"),
					isNull(bookmark.description),
					isNull(bookmark.image),
					isNull(bookmark.favicon),
				),
			),
			columns: { id: true, url: true },
		});

		if (unenriched.length === 0) {
			return { queued: 0 };
		}

		// Trigger.dev batch limit is 1 000 items — chunk if needed.
		const CHUNK_SIZE = 1000;
		for (let i = 0; i < unenriched.length; i += CHUNK_SIZE) {
			const chunk = unenriched.slice(i, i + CHUNK_SIZE);
			await tasks
				.batchTrigger<typeof enrichBookmark>(
					"enrich-bookmark",
					chunk.map((b) => ({
						payload: {
							bookmarkId: b.id,
							userId: activeUser.id,
							url: b.url,
						},
					})),
				)
				.catch((err) =>
					console.error("Failed to batch trigger enrichment:", err),
				);
		}

		return { queued: unenriched.length };
	})

	.patch(
		"/:id/move",
		async ({ params, body, user, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const payload = body as MoveBookmarkBody;

			const [updated] = await db
				.update(bookmark)
				.set({ collectionId: payload.collectionId, updatedAt: new Date() })
				.where(
					and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
				)
				.returning();
			if (!updated) {
				set.status = 404;
				return { message: "Not found" };
			}
			return updated;
		},
		{
			body: t.Object({ collectionId: t.Nullable(t.String()) }),
		},
	)

	// ─── PATCH trash (soft delete) ────────────────────────────────────────────
	.patch("/:id/trash", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const [updated] = await db
			.update(bookmark)
			.set({ isTrashed: true, trashedAt: new Date(), updatedAt: new Date() })
			.where(
				and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
			)
			.returning();

		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		return updated;
	})

	// ─── PATCH restore from trash ─────────────────────────────────────────────
	.patch("/:id/restore", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const [updated] = await db
			.update(bookmark)
			.set({ isTrashed: false, trashedAt: null, updatedAt: new Date() })
			.where(
				and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
			)
			.returning();

		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		return updated;
	})

	// ─── DELETE hard delete (permanent) ──────────────────────────────────────
	.delete("/:id", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const [deleted] = await db
			.delete(bookmark)
			.where(
				and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
			)
			.returning();

		if (!deleted) {
			set.status = 404;
			return { message: "Not found" };
		}
		return { success: true };
	})

	// ─── DELETE purge old trash (7 days) ─────────────────────────────────────
	.delete("/trash/purge", async ({ user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const deleted = await db
			.delete(bookmark)
			.where(
				and(
					eq(bookmark.userId, activeUser.id),
					eq(bookmark.isTrashed, true),
					lt(bookmark.trashedAt, sevenDaysAgo),
				),
			)
			.returning();

		return { purged: deleted.length };
	})

	.patch("/:id/read", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;
		const [updated] = await db
			.update(bookmark)
			.set({ isRead: true, updatedAt: new Date() })
			.where(
				and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
			)
			.returning();
		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		await recordActivityAndEvaluate(activeUser.id, "bookmark_read");
		return updated;
	})
	.patch("/:id/unread", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;
		const [updated] = await db
			.update(bookmark)
			.set({ isRead: false, updatedAt: new Date() })
			.where(
				and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
			)
			.returning();
		if (!updated) {
			set.status = 404;
			return { message: "Not found" };
		}
		await recordActivityAndEvaluate(activeUser.id, "bookmark_unread");
		return updated;
	})
	// ─── PATCH visibility ──────────────────────────────────────────────────────
	.patch(
		"/:id/visibility",
		async ({ params, body, user, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const payload = body as BookmarkVisibilityBody;

			const [updated] = await db
				.update(bookmark)
				.set({
					visibility: payload.visibility,
					updatedAt: new Date(),
				})
				.where(
					and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
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
	// ─── PATCH tags (replace bookmark tags) ────────────────────────────────────
	.patch(
		"/:id/tags",
		async ({ params, body, user, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			// Ensure the bookmark belongs to the caller before touching tag pivots.
			const existing = await db.query.bookmark.findFirst({
				where: and(
					eq(bookmark.id, params.id),
					eq(bookmark.userId, activeUser.id),
				),
				columns: { id: true, userId: true },
			});

			if (!existing) {
				set.status = 404;
				return { message: "Not found" };
			}

			const payload = body as BookmarkTagsBody;
			const tagIds = payload.tagIds ?? [];

			// If there are tag IDs, verify they all belong to this user.
			if (tagIds.length > 0) {
				const userTags = await db.query.tag.findMany({
					where: and(eq(tag.userId, activeUser.id), inArray(tag.id, tagIds)),
					columns: { id: true },
				});

				if (userTags.length !== tagIds.length) {
					set.status = 400;
					return { message: "One or more tags do not belong to the user" };
				}
			}

			// Replace the bookmark's tag set. neon-http driver does not support
			// transactions, so we run delete then insert sequentially.
			await db
				.delete(bookmarkTag)
				.where(eq(bookmarkTag.bookmarkId, existing.id));

			if (tagIds.length > 0) {
				await db.insert(bookmarkTag).values(
					tagIds.map((tagId) => ({
						bookmarkId: existing.id,
						tagId,
					})),
				);
			}

			// Return the updated bookmark with its tags so the client can sync.
			const updated = await db.query.bookmark.findFirst({
				where: and(
					eq(bookmark.id, params.id),
					eq(bookmark.userId, activeUser.id),
				),
				with: { collection: true, tags: { with: { tag: true } } },
			});

			return updated;
		},
		{
			body: t.Object({
				tagIds: t.Array(t.String()),
			}),
		},
	)
	.patch("/:id/favorite", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;
		const existing = await db.query.bookmark.findFirst({
			where: and(
				eq(bookmark.id, params.id),
				eq(bookmark.userId, activeUser.id),
			),
		});
		if (!existing) {
			set.status = 404;
			return { message: "Not found" };
		}
		const [updated] = await db
			.update(bookmark)
			.set({ isFavorite: !existing.isFavorite, updatedAt: new Date() })
			.where(
				and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
			)
			.returning();
		if (updated) {
			await recordActivityAndEvaluate(
				activeUser.id,
				existing.isFavorite ? "bookmark_unfavorited" : "bookmark_favorited",
			);
		}
		return updated;
	})

	// ─── PATCH update (title + description) ──────────────────────────────────
	.patch(
		"/:id",
		async ({ params, body, user, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const payload = body as UpdateBookmarkBody;

			const [updated] = await db
				.update(bookmark)
				.set({
					...(payload.title !== undefined && { title: payload.title }),
					...(payload.description !== undefined && {
						description: payload.description,
					}),
					updatedAt: new Date(),
				})
				.where(
					and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
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
				title: t.Optional(t.Nullable(t.String())),
				description: t.Optional(t.Nullable(t.String())),
			}),
		},
	)

	// ─── POST generate title ──────────────────────────────────────────────────
	.post("/:id/generate-title", async ({ params, user, set }) => {
		const activeUser = getActiveUser(user, set);
		if ("message" in activeUser) return activeUser;

		const existing = await db.query.bookmark.findFirst({
			where: and(
				eq(bookmark.id, params.id),
				eq(bookmark.userId, activeUser.id),
			),
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
			.where(
				and(eq(bookmark.id, params.id), eq(bookmark.userId, activeUser.id)),
			)
			.returning();

		return updated;
	});
