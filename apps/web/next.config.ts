import "@Kura/env/web";
import crypto from "node:crypto";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Bust static chunk URLs when the API origin changes so CDN/browser caches cannot keep an
	// old bundle that inlined a different `NEXT_PUBLIC_SERVER_URL` (e.g. localhost).
	generateBuildId: async () => {
		const url = process.env.NEXT_PUBLIC_SERVER_URL ?? "";
		const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 12);
		return `kura-${hash}`;
	},
	output: "standalone",
	typedRoutes: true,
	reactCompiler: true,
	transpilePackages: ["shiki"],
	// Allow `next/image` to load images from any external host (favicons, OG images, etc.)
	// Specific patterns above are kept for clarity; ** allows bookmark/OG URLs from any domain.
	// Note: Allowing all hostnames can be abused via SVG; we only use this for known image URLs (jpg, png, etc.).
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "www.google.com",
				pathname: "/s2/**",
			},
			{
				protocol: "https",
				hostname: "kigen.design",
				pathname: "/**",
			},
			// Allow images from any HTTPS host (e.g. poly.app, other bookmark/OG sources)
			{
				protocol: "https",
				hostname: "**",
				pathname: "/**",
			},
			{
				protocol: "http",
				hostname: "**",
				pathname: "/**",
			},
		],
	},
};

export default nextConfig;
