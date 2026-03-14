import { auth } from "@Kura/auth";
import { db } from "@Kura/db";
import { user as userTable } from "@Kura/db/schema/auth";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
	{ as: "global" },
	async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		const fullUser = session?.user?.id
			? await db.query.user.findFirst({
					where: eq(userTable.id, session.user.id),
				})
			: null;

		return {
			user: fullUser ?? null,
			session: session?.session ?? null,
		};
	},
);
