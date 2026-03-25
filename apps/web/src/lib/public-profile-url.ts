import { env } from "@Kura/env/web";

/**
 * Canonical public profile URL on the dedicated profile domain (e.g. `https://alice.cura.page`).
 */
export function getPublicProfileUrl(username: string): string {
	const domain = env.NEXT_PUBLIC_PROFILE_DOMAIN;
	return `https://${username}.${domain}`;
}
