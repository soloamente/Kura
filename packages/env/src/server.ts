import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Explicit `undefined` generic: server-only config — otherwise `TPrefix` can widen and
// `createEnv` mis-types the `server` map (prefix / no-prefix branch) under strict tsc.
export const env = createEnv<undefined>({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
