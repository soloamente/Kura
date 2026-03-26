import type { NextRequest } from "next/server";

/**
 * Runtime proxy for Better Auth when `next.config.ts` rewrites are empty.
 * Rewrites are built from `KURA_API_UPSTREAM` at `next build`; if that env was
 * missing during the build, `/api/auth/*` would 404 with no matching route.
 * This handler forwards to the same upstream at request time so production
 * can fix auth by setting the var and redeploying (or using runtime env only).
 *
 * When rewrites are present, Next applies them before filesystem routing, so
 * this file is not used — no double proxy.
 */
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

function getApiUpstream(): string | null {
	const raw = process.env.KURA_API_UPSTREAM;
	if (!raw?.trim()) return null;
	return raw.replace(/\/$/, "");
}

async function proxyAuth(
	request: NextRequest,
	params: { path?: string[] },
): Promise<Response> {
	const base = getApiUpstream();
	if (!base) {
		return Response.json(
			{
				error: "Auth proxy is not configured",
				hint: "Set KURA_API_UPSTREAM on the web deployment to your API origin (e.g. https://kura-server.vercel.app) and redeploy.",
			},
			{ status: 503 },
		);
	}

	const segments = params.path ?? [];
	const pathPart = segments.length > 0 ? segments.join("/") : "";
	const src = request.nextUrl;
	const targetUrl = pathPart
		? `${base}/api/auth/${pathPart}${src.search}`
		: `${base}/api/auth${src.search}`;

	const headers = new Headers();
	request.headers.forEach((value, key) => {
		const lower = key.toLowerCase();
		if (HOP_BY_HOP.has(lower)) return;
		// Let `fetch` set Host for the upstream; preserve the browser host for the API.
		if (lower === "host") return;
		headers.set(key, value);
	});
	headers.set("x-forwarded-host", request.headers.get("host") ?? "");
	headers.set("x-forwarded-proto", src.protocol.replace(":", ""));

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
		if (lower === "transfer-encoding") return;
		out.append(key, value);
	});

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: out,
	});
}

export async function GET(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyAuth(request, await ctx.params);
}

export async function POST(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyAuth(request, await ctx.params);
}

export async function PUT(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyAuth(request, await ctx.params);
}

export async function PATCH(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyAuth(request, await ctx.params);
}

export async function DELETE(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyAuth(request, await ctx.params);
}

export async function OPTIONS(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyAuth(request, await ctx.params);
}
