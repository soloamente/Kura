import type { Metadata } from "next";
import { ToastProvider } from "@Kura/ui/components/toast";
import { ExplorePageClient } from "@/app/explore/explore-page-client";
import { AuthGate } from "@/components/auth-gate";
import { Header } from "@/components/header/header";

export const metadata: Metadata = {
	title: "Explore · Cura",
	description: "Discover collections and bookmarks on Cura.",
};

export default function ExplorePage() {
	return (
		<AuthGate>
			<ToastProvider>
				<div className="flex h-screen flex-col">
					<Header />
					<ExplorePageClient />
				</div>
			</ToastProvider>
		</AuthGate>
	);
}
