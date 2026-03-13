import { db } from "@Kura/db";
import * as schema from "@Kura/db/schema/auth";
import { env } from "@Kura/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",

		schema: schema,
	}),
	trustedOrigins: [env.CORS_ORIGIN],
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: env.NODE_ENV === "production" ? "none" : "lax",
			secure: env.NODE_ENV === "production",
			httpOnly: true,
		},
	},
	plugins: [],
});
