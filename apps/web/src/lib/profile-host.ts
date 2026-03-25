/**
 * Shared rules for public profile hosts (`<username>.cura.page`) and proxy routing.
 * Keep in sync with onboarding username rules (`slugify` in username-onboarding).
 */

/** Labels that must never be treated as profile subdomains or `/:segment` profile paths. */
export const RESERVED_PROFILE_LABELS = new Set([
	"www",
	"app",
	"api",
	"staging",
	"admin",
	"dashboard",
	"explore",
	"login",
	"ai",
	"settings",
	"mail",
	"ftp",
	"cdn",
	"_vercel",
	"_next",
	"manifest.webmanifest",
	"robots.txt",
]);

/** Lowercase a–z, digits, underscore; length 2–24 (same idea as username onboarding). */
export const PROFILE_USERNAME_LABEL_RE = /^[a-z0-9_]{2,24}$/;

/**
 * Returns the first DNS label when `host` is `<label>.<profileDomain>` or `<label>.localhost`,
 * or `null` for apex / non-profile hosts.
 */
export function parseProfileSubdomainFromHost(
	hostname: string,
	profileDomain: string,
): string | null {
	const host = hostname.toLowerCase();
	const domain = profileDomain.toLowerCase();

	if (host === domain || host === `www.${domain}`) {
		return null;
	}

	if (host.endsWith(`.${domain}`)) {
		const sub = host.slice(0, -(domain.length + 1));
		if (!sub || sub.includes(".")) return null;
		return sub;
	}

	if (host.endsWith(".localhost")) {
		const sub = host.slice(0, -".localhost".length);
		if (!sub || sub.includes(".")) return null;
		return sub;
	}

	return null;
}
