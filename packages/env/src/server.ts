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
	CORS_ORIGIN: z.url(),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
};

export const env = createEnv<undefined, typeof serverSchema>({
	server: serverSchema,
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
