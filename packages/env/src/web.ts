import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		NEXT_PUBLIC_SERVER_URL: z.url(),
		/** Apex domain for public profiles (`<username>.cura.page`). Used by `src/proxy.ts`. */
		NEXT_PUBLIC_PROFILE_DOMAIN: z.string().min(1).default("cura.page"),
		/**
		 * Origin of the main Next app (dashboard, explore, settings) — not `*.cura.page` profiles.
		 * Default matches production on the **`cura.page`** apex; override in `.env` for previews or custom domains.
		 */
		NEXT_PUBLIC_WEB_APP_URL: z.string().url().default("https://cura.page"),
	},
	runtimeEnv: {
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
		NEXT_PUBLIC_PROFILE_DOMAIN: process.env.NEXT_PUBLIC_PROFILE_DOMAIN,
		NEXT_PUBLIC_WEB_APP_URL: process.env.NEXT_PUBLIC_WEB_APP_URL,
	},
	emptyStringAsUndefined: true,
});
