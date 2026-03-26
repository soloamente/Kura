/**
 * Next.js 16+ request proxy (replaces `middleware.ts`).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 *
 * 1) `*.cura.page` / `*.localhost` → rewrite to `app/[username]/` (e.g. `https://alice.cura.page/` → `/alice`).
 * 2) Optional: `/:username` on the main app host → 301/308 to `https://username.cura.page/` (canonical URL).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
	parseProfileSubdomainFromHost,
	PROFILE_USERNAME_LABEL_RE,
	RESERVED_PROFILE_LABELS,
} from "@/lib/profile-host";

/** File-like paths we should not prefix with `/<username>` when rewriting subdomains. */
const STATIC_FILE_RE =
	/\.(?:ico|png|jpg|jpeg|gif|webp|svg|txt|xml|json|webmanifest|map|css|js|woff2?|ttf|otf)$/i;

function shouldSkipPathRedirect(): boolean {
	if (process.env.NEXT_PUBLIC_PROFILE_PATH_REDIRECT === "false") {
		return true;
	}
	// Avoid sending preview deployments to production profile hosts.
	if (process.env.VERCEL_ENV === "preview") {
		return true;
	}
	return false;
}

function handleSubdomainRewrite(
	request: NextRequest,
	profileDomain: string,
): NextResponse | null {
	const rawHost = request.headers.get("host") ?? "";
	const hostname = rawHost.split(":")[0] ?? "";

	const sub = parseProfileSubdomainFromHost(hostname, profileDomain);
	if (
		!sub ||
		RESERVED_PROFILE_LABELS.has(sub) ||
		!PROFILE_USERNAME_LABEL_RE.test(sub)
	) {
		return null;
	}

	const { pathname } = request.nextUrl;

	// API proxy prefix (see `next.config.ts` `/_kura` rewrites) — must not be prefixed with `/<username>/`.
	if (pathname.startsWith("/_kura")) {
		return null;
	}

	if (pathname.startsWith("/_next") || pathname.startsWith("/.well-known")) {
		return null;
	}

	if (STATIC_FILE_RE.test(pathname)) {
		return null;
	}

	const rewritePath =
		pathname === "/" ? `/${sub}` : `/${sub}${pathname}`;

	const url = request.nextUrl.clone();
	url.pathname = rewritePath;

	return NextResponse.rewrite(url);
}

/**
 * `https://app.example/alice` → `https://alice.cura.page/` (and `http://localhost:3001/alice` → `http://alice.localhost:3001/`).
 */
function handlePathToProfileRedirect(
	request: NextRequest,
	profileDomain: string,
): NextResponse | null {
	if (shouldSkipPathRedirect()) {
		return null;
	}

	const rawHost = request.headers.get("host") ?? "";
	const hostname = rawHost.split(":")[0] ?? "";

	// Already on a profile subdomain — not a legacy path URL.
	if (parseProfileSubdomainFromHost(hostname, profileDomain)) {
		return null;
	}

	const pathname = request.nextUrl.pathname;
	const match = pathname.match(/^\/([^/]+)\/?$/);
	if (!match) return null;

	const segment = match[1].toLowerCase();
	if (RESERVED_PROFILE_LABELS.has(segment)) {
		return null;
	}
	if (!PROFILE_USERNAME_LABEL_RE.test(segment)) {
		return null;
	}

	const dest = request.nextUrl.clone();

	if (hostname === "localhost" || hostname === "127.0.0.1") {
		dest.hostname = `${segment}.localhost`;
		dest.pathname = "/";
		return NextResponse.redirect(dest, 308);
	}

	dest.protocol = "https:";
	dest.hostname = `${segment}.${profileDomain}`;
	dest.port = "";
	dest.pathname = "/";
	return NextResponse.redirect(dest, 308);
}

export function proxy(request: NextRequest) {
	const profileDomain =
		process.env.NEXT_PUBLIC_PROFILE_DOMAIN ?? "cura.page";

	const rewritten = handleSubdomainRewrite(request, profileDomain);
	if (rewritten) {
		return rewritten;
	}

	const redirected = handlePathToProfileRedirect(request, profileDomain);
	if (redirected) {
		return redirected;
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
	],
};
