/**
 * Browser tab / SEO title for a public profile (used by `app/[username]/page.tsx` metadata).
 * Prefer display name + handle when the name differs from the username.
 */
export function getPublicProfileTitle(name: string, username: string): string {
	const trimmedName = name.trim();
	const uname = username.trim();
	if (!trimmedName || trimmedName.toLowerCase() === uname.toLowerCase()) {
		return `@${uname} · Cura`;
	}
	return `${trimmedName} (@${uname}) · Cura`;
}

/** Meta description: bio when present, otherwise a short default. */
export function getPublicProfileDescription(
	bio: string | null | undefined,
	username: string,
): string {
	const b = bio?.trim();
	if (b) {
		return b.length > 160 ? `${b.slice(0, 157)}…` : b;
	}
	return `Public profile of @${username.trim()} on Cura.`;
}
