/**
 * Extension ↔ backend URLs
 *
 * API requests must target the same origin as `NEXT_PUBLIC_SERVER_URL` on the web app so the
 * Better Auth session cookie (set on the API host) is sent with `credentials: "include"`.
 *
 * Build for production with `.env.production` (or CI env) set, e.g.:
 *   WXT_PUBLIC_API_URL=https://your-api.vercel.app
 *   WXT_PUBLIC_WEB_URL=https://your-next-app.vercel.app
 *
 * Browsers can still override the API origin via `chrome.storage.local` key `kura_api_base`
 * (see `getApiBase` in background / popup).
 */
const configuredApi = import.meta.env.WXT_PUBLIC_API_URL;
const configuredWeb = import.meta.env.WXT_PUBLIC_WEB_URL;

/** Hono API origin (no trailing slash). */
export const DEFAULT_API_ORIGIN: string =
	configuredApi ??
	(import.meta.env.DEV ? "http://localhost:3000" : "https://app.kura.so");

/** Next.js app origin for login / settings links (no trailing slash). */
export const DEFAULT_WEB_ORIGIN: string =
	configuredWeb ??
	(import.meta.env.DEV ? "http://localhost:3001" : "https://app.kura.so");
