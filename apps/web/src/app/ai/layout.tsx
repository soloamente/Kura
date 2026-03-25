import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "AI · Cura",
	description: "Chat with Cura’s assistant.",
};

export default function AILayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return children;
}
