import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		NEXT_PUBLIC_SERVER_URL: z.url(),
		/** Apex domain for public profiles (`<username>.cura.page`). Used by `src/proxy.ts`. */
		NEXT_PUBLIC_PROFILE_DOMAIN: z.string().min(1).default("cura.page"),
	},
	runtimeEnv: {
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
		NEXT_PUBLIC_PROFILE_DOMAIN: process.env.NEXT_PUBLIC_PROFILE_DOMAIN,
	},
	emptyStringAsUndefined: true,
});
