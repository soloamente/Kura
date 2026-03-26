import { env } from "@Kura/env/web";
import { createAuthClient } from "better-auth/react";

/**
 * Auth routes must be requested under `/api/auth/*` on the **web origin** (e.g. `https://cura.page`).
 * Do not pass `NEXT_PUBLIC_SERVER_URL` here when it includes a path like `/_kura`: the URL resolver
 * drops path segments when joining an absolute `/api/auth/...` path, breaking the proxy.
 * @see `next.config.ts` rewrites for `/api/auth/*` → API upstream.
 */
export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_WEB_APP_URL.replace(/\/$/, ""),
	fetchOptions: {
		credentials: "include",
	},
});
