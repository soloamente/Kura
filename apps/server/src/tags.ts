import { db } from "@Kura/db";
import { tag } from "@Kura/db/schema/bookmarks";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./middleware/auth";
import { getActiveUser } from "./middleware/auth-guards";

export const tagsRouter = new Elysia({ prefix: "/tags" })
	.use(authMiddleware)

	// ─── GET all tags for current user ─────────────────────────────────────────
	.get("/", async ({ user, set }) => {
		if (!user) {
			set.status = 401;
			return { message: "Unauthorized" };
		}

		// Return the caller's tag catalog ordered by name for predictable menus.
		const tags = await db.query.tag.findMany({
			where: eq(tag.userId, user.id),
			orderBy: (t, { asc }) => [asc(t.name)],
		});

		return tags;
	})

	// ─── POST create a new tag for current user ───────────────────────────────
	.post(
		"/",
		async ({ user, body, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const rawName = body.name.trim();
			if (!rawName) {
				set.status = 400;
				return { message: "Tag name is required" };
			}

			// Avoid obvious duplicates by doing a case-insensitive comparison in JS.
			const existingTags = await db.query.tag.findMany({
				where: eq(tag.userId, activeUser.id),
			});
			const existing = existingTags.find(
				(t) => t.name.toLocaleLowerCase() === rawName.toLocaleLowerCase(),
			);

			if (existing) {
				// Reuse the existing tag instead of creating a near-duplicate.
				return existing;
			}

			const [created] = await db
				.insert(tag)
				.values({
					id: crypto.randomUUID(),
					userId: activeUser.id,
					name: rawName,
					color: body.color ?? null,
				})
				.returning();

			return created;
		},
		{
			body: t.Object({
				name: t.String(),
				color: t.Optional(t.Nullable(t.String())),
			}),
		},
	)

	// ─── PATCH update tag (name and/or color) ──────────────────────────────────
	.patch(
		"/:id",
		async ({ user, params, body, set }) => {
			const activeUser = getActiveUser(user, set);
			if ("message" in activeUser) return activeUser;

			const existing = await db.query.tag.findFirst({
				where: eq(tag.id, params.id),
			});

			if (!existing || existing.userId !== activeUser.id) {
				set.status = 404;
				return { message: "Not found" };
			}

			const updates: { name?: string; color?: string | null } = {};
			if (body.name !== undefined) {
				const trimmed = body.name.trim();
				if (!trimmed) {
					set.status = 400;
					return { message: "Tag name cannot be empty" };
				}
				updates.name = trimmed;
			}
			if (body.color !== undefined) updates.color = body.color;

			const [updated] = await db
				.update(tag)
				.set(updates)
				.where(eq(tag.id, params.id))
				.returning();

			return updated;
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				color: t.Optional(t.Nullable(t.String())),
			}),
		},
	);
