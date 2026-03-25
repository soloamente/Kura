import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { env } from "@Kura/env/web";

import "../index.css";
import Providers from "@/components/providers";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

/** Default meta + OG copy: one clear promise (save → organize → share) for crawlers and link previews. */
const SITE_DESCRIPTION =
	"Save links, organize them into collections, and share a public profile—so what you care about stays findable, not lost in tabs.";

export const metadata: Metadata = {
	// Resolves absolute URLs for `opengraph-image` and other metadata in production.
	metadataBase: new URL(env.NEXT_PUBLIC_WEB_APP_URL.replace(/\/$/, "")),
	applicationName: "Cura",
	// Default tab title; child routes override with their own `title`.
	title: "Cura",
	description: SITE_DESCRIPTION,
	keywords: [
		"bookmarks",
		"bookmark manager",
		"link collections",
		"share links",
		"Cura",
	],
	openGraph: {
		type: "website",
		siteName: "Cura",
		// Slightly fuller line for previews than the bare tab title.
		title: "Cura — Save, organize, and share what you find",
		description: SITE_DESCRIPTION,
	},
	twitter: {
		card: "summary_large_image",
		title: "Cura — Save, organize, and share what you find",
		description: SITE_DESCRIPTION,
	},
	robots: {
		index: true,
		follow: true,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${inter.variable} ${geistMono.variable} antialiased`}>
				<Providers>
					<div className="isolate grid h-svh grid-rows-[auto_1fr]">
						{children}
					</div>
				</Providers>
			</body>
		</html>
	);
}
