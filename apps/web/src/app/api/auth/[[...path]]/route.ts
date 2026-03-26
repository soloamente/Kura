import type { NextRequest } from "next/server";
import { proxyKuraUpstream } from "@/lib/upstream-api-proxy";

/**
 * Proxies Better Auth to `KURA_API_UPSTREAM` with correct response headers (see
 * `upstream-api-proxy.ts`). `/api/auth/*` is not rewritten in `next.config.ts`
 * so we avoid external rewrite gzip/header mismatches.
 */
export async function GET(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "auth");
}

export async function POST(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "auth");
}

export async function PUT(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "auth");
}

export async function PATCH(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "auth");
}

export async function DELETE(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "auth");
}

export async function OPTIONS(
	request: NextRequest,
	ctx: { params: Promise<{ path?: string[] }> },
) {
	return proxyKuraUpstream(request, await ctx.params, "auth");
}
