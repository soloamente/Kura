import { auth } from "@Kura/auth";
import Elysia from "elysia";

export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
	{ as: "global" },
	async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		return {
			user: session?.user ?? null,
			session: session?.session ?? null,
		};
	},
);
