import type { NextRequest } from "next/server";

/** Hop-by-hop headers we must not forward to the upstream or back to the client. */
const HOP_BY_HOP = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade",
]);

/** Response headers that must be dropped when Node `fetch` has already decompressed the body. */
const STRIP_FROM_CLIENT_RESPONSE = new Set([
	"transfer-encoding",
	"content-encoding",
	"content-length",
]);

export function getKuraApiUpstream(): string | null {
	const raw = process.env.KURA_API_UPSTREAM;
	if (!raw?.trim()) return null;
	return raw.replace(/\/$/, "");
}

export type UpstreamProxyKind = "auth" | "api";

/**
 * Forwards the browser request to the real API (`KURA_API_UPSTREAM`).
 * - `auth` → `{base}/api/auth/{path}`
 * - `api` → `{base}/{path}` (same paths as hitting the API origin directly, e.g. `/users/me`)
 */
export async function proxyKuraUpstream(
	request: NextRequest,
	params: { path?: string[] },
	kind: UpstreamProxyKind,
): Promise<Response> {
	const base = getKuraApiUpstream();
	if (!base) {
		return Response.json(
			{
				error: "API proxy is not configured",
				hint: "Set KURA_API_UPSTREAM on the web deployment to your API origin (e.g. https://kura-server.vercel.app) and redeploy.",
			},
			{ status: 503 },
		);
	}

	const segments = params.path ?? [];
	const pathPart = segments.length > 0 ? segments.join("/") : "";
	const src = request.nextUrl;
	const search = src.search;

	let targetUrl: string;
	if (kind === "auth") {
		targetUrl = pathPart
			? `${base}/api/auth/${pathPart}${search}`
			: `${base}/api/auth${search}`;
	} else {
		// Same URL shape as the API origin (no stray `/` before `?`).
		targetUrl = pathPart ? `${base}/${pathPart}${search}` : `${base}${search}`;
	}

	const headers = new Headers();
	request.headers.forEach((value, key) => {
		const lower = key.toLowerCase();
		if (HOP_BY_HOP.has(lower)) return;
		if (lower === "host") return;
		headers.set(key, value);
	});
	headers.set("x-forwarded-host", request.headers.get("host") ?? "");
	headers.set("x-forwarded-proto", src.protocol.replace(":", ""));
	headers.set("accept-encoding", "identity");

	const init: RequestInit = {
		method: request.method,
		headers,
		redirect: "manual",
	};

	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = await request.arrayBuffer();
	}

	const upstream = await fetch(targetUrl, init);

	const out = new Headers();
	upstream.headers.forEach((value, key) => {
		const lower = key.toLowerCase();
		if (STRIP_FROM_CLIENT_RESPONSE.has(lower)) return;
		out.append(key, value);
	});

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: out,
	});
}
