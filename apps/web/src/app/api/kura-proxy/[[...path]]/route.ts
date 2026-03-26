import type { NextRequest } from "next/server";
import { proxyKuraUpstream } from "@/lib/upstream-api-proxy";

/**
 * Serves the same-origin `/_kura/*` API surface via an **internal** rewrite from
 * `next.config.ts` (`/_kura/:path*` → `/api/kura-proxy/:path*`). Browsers still
 * call `NEXT_PUBLIC_SERVER_URL` (`https://cura.page/_kura/...`).
 *
 * We cannot use `app/_kura/...` — in the App Router, `_folders` are private and
 * do not create routes. External rewrites to the API also 404 when
 * `KURA_API_UPSTREAM` was missing at build time; this handler only needs the
 * env at runtime.
 */
export async function GET(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "api");
}

export async function POST(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "api");
}

export async function PUT(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "api");
}

export async function PATCH(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "api");
}

export async function DELETE(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "api");
}

export async function OPTIONS(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "api");
}
