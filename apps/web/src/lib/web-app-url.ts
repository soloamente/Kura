import { env } from "@Kura/env/web";

/** Main Next.js app origin (no trailing slash), e.g. `https://cura.page` (see `NEXT_PUBLIC_WEB_APP_URL`). */
export function getWebAppOrigin(): string {
	return env.NEXT_PUBLIC_WEB_APP_URL.replace(/\/$/, "");
}

/** Absolute URL to the signed-in dashboard on the main app host. */
export function getDashboardUrl(): string {
	return `${getWebAppOrigin()}/dashboard`;
}
