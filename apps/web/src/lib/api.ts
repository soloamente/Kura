import { env } from "@Kura/env/web";
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../server/src/main";

// Must match the API origin (same as Better Auth); never hardcode localhost for deployed builds.
export const api = treaty<App>(env.NEXT_PUBLIC_SERVER_URL, {
	fetch: { credentials: "include" },
});
