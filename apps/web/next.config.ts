import "@Kura/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
