/**
 * Parse comma-separated CORS / Better Auth `trustedOrigins` values.
 * Supports optional `https://*.example.com` style wildcards (Better Auth compatible).
 */
export function parseOriginList(raw: string): string[] {
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Returns whether `origin` matches an entry (exact or `https://*.domain` / `http://*.domain`). */
export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
	if (!origin) return true;
	for (const entry of allowed) {
		if (entry === origin) return true;
		const m = entry.match(/^https?:\/\/\*\.(.+)$/);
		if (m) {
			const suffix = m[1];
			try {
				const u = new URL(origin);
				if (u.hostname === suffix || u.hostname.endsWith(`.${suffix}`)) {
					return true;
				}
			} catch {
				continue;
			}
		}
	}
	return false;
}
