import { db } from "@Kura/db";
import * as schema from "@Kura/db/schema/auth";
import { parseOriginList } from "@Kura/env/cors-origins";
import { env } from "@Kura/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",

		schema: schema,
	}),
	// Match `CORS_ORIGIN` (comma-separated + optional `https://*.domain` for profile subdomains).
	trustedOrigins: parseOriginList(env.CORS_ORIGIN),
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		// Safari (ITP): when the API is on a different host than the web app, use a proxy on the web origin
		// (`/_kura/*` → API) and set `BETTER_AUTH_URL` to that public URL; optionally set `AUTH_COOKIE_DOMAIN`
		// so `*.cura.page` and apex share the session cookie.
		...(env.AUTH_COOKIE_DOMAIN
			? {
					crossSubDomainCookies: {
						enabled: true,
						domain: env.AUTH_COOKIE_DOMAIN,
					},
				}
			: {}),
		defaultCookieAttributes: {
			sameSite: env.NODE_ENV === "production" ? "none" : "lax",
			secure: env.NODE_ENV === "production",
			httpOnly: true,
		},
	},
	plugins: [],
});
