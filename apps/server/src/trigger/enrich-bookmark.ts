import { task } from "@trigger.dev/sdk/v3";
import { db } from "@Kura/db";
import { bookmark } from "@Kura/db/schema/bookmarks";
import { and, eq } from "drizzle-orm";

interface EnrichBookmarkPayload {
	bookmarkId: string;
	userId: string;
	url: string;
}

interface PageMetadata {
	title: string | null;
	description: string | null;
	image: string | null;
	siteName: string | null;
	favicon: string | null;
}

async function fetchMetadata(url: string): Promise<PageMetadata> {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(10000),
		headers: {
			"User-Agent": "Mozilla/5.0 (compatible; Kura/1.0; +https://kura.app)",
		},
	});

	const html = await res.text();

	const get = (pattern: RegExp) => pattern.exec(html)?.[1]?.trim() ?? null;

	// title: og:title > twitter:title > <title>
	const title =
		get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
		get(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ??
		get(/<title[^>]*>([^<]+)<\/title>/i);

	// description: og:description > twitter:description > meta description
	const description =
		get(
			/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
		) ??
		get(
			/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
		) ??
		get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

	// og:image
	const image =
		get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
		get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

	// og:site_name
	const siteName = get(
		/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
	);

	// favicon: <link rel="icon"> or /favicon.ico fallback
	const faviconHref =
		get(
			/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
		) ??
		get(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);

	let favicon: string | null = null;
	if (faviconHref) {
		// resolve relative URLs
		try {
			favicon = new URL(faviconHref, url).toString();
		} catch {
			favicon = faviconHref;
		}
	} else {
		// fallback to /favicon.ico
		try {
			favicon = new URL("/favicon.ico", url).toString();
		} catch {
			favicon = null;
		}
	}

	// resolve relative og:image
	let resolvedImage = image;
	if (image) {
		try {
			resolvedImage = new URL(image, url).toString();
		} catch {
			resolvedImage = image;
		}
	}

	return { title, description, image: resolvedImage, siteName, favicon };
}

export const enrichBookmark = task({
	id: "enrich-bookmark",
	maxDuration: 60,
	retry: {
		maxAttempts: 3,
		minTimeoutInMs: 2000,
		maxTimeoutInMs: 15000,
		factor: 2,
	},
	run: async (payload: EnrichBookmarkPayload) => {
		const { bookmarkId, userId, url } = payload;

		// verify bookmark still exists and belongs to user
		const existing = await db.query.bookmark.findFirst({
			where: and(eq(bookmark.id, bookmarkId), eq(bookmark.userId, userId)),
		});

		if (!existing) {
			return { skipped: true, reason: "bookmark not found" };
		}

		// fetch metadata
		let metadata: PageMetadata;
		try {
			metadata = await fetchMetadata(url);
		} catch (err) {
			console.error(`Failed to fetch metadata for ${url}:`, err);
			return { skipped: true, reason: "fetch failed" };
		}

		// only update fields that we got — don't overwrite existing good data
		const updates: Partial<typeof existing> = {
			updatedAt: new Date(),
		};

		if (metadata.description) updates.description = metadata.description;
		if (metadata.image) updates.image = metadata.image;
		if (metadata.siteName) updates.siteName = metadata.siteName;
		if (metadata.favicon) updates.favicon = metadata.favicon;

		// update title only if it's still the raw URL placeholder
		const titleIsPlaceholder =
			!existing.title ||
			existing.title === url ||
			existing.title.startsWith("http");

		if (metadata.title && titleIsPlaceholder) {
			updates.title = metadata.title;
		}

		const [updated] = await db
			.update(bookmark)
			.set(updates)
			.where(and(eq(bookmark.id, bookmarkId), eq(bookmark.userId, userId)))
			.returning();

		return {
			success: true,
			bookmarkId,
			title: updated.title,
			hasImage: !!updated.image,
			hasDescription: !!updated.description,
		};
	},
});
