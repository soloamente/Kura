import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign in · Cura",
	description: "Sign in or create an account on Cura.",
};

export default function LoginLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return children;
}
