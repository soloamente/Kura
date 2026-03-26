import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// `TPrefix` must be `undefined` for a server-only schema (see t3-env prefix branch types).
// `TServer` must be passed explicitly — `createEnv<undefined>` alone defaults `TServer` to `{}`,
// so consumers lose `env.CORS_ORIGIN` etc. under strict tsc.
const serverSchema = {
	DATABASE_URL: z.string().min(1),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	/**
	 * Comma-separated allowed browser origins (CORS + Better Auth `trustedOrigins`).
	 * Include apex and profile hosts, e.g. `https://cura.page,https://*.cura.page`.
	 */
	CORS_ORIGIN: z.string().min(1),
	/**
	 * Optional registrable domain for shared session cookies across subdomains (e.g. `cura.page`).
	 * Set when the web app uses `*.cura.page` profiles and/or `NEXT_PUBLIC_SERVER_URL` is proxied on the same domain.
	 * See Better Auth: Safari / ITP + cross-subdomain cookies.
	 */
	AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
};

export const env = createEnv<undefined, typeof serverSchema>({
	server: serverSchema,
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
