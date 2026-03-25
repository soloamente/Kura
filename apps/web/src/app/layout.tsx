import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

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

export const metadata: Metadata = {
	title: "Cura",
	description: "Kura",
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
