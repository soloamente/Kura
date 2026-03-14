import { ToastProvider } from "@Kura/ui/components/toast";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ExplorePageClient } from "@/app/explore/explore-page-client";
import { Header } from "@/components/header/header";
import { authClient } from "@/lib/auth-client";

export default async function ExplorePage() {
	const session = await authClient.getSession({
		fetchOptions: {
			headers: await headers(),
			throw: true,
		},
	});

	if (!session?.user) {
		redirect("/login");
	}

	return (
		<ToastProvider>
			<div className="flex h-screen flex-col">
				<Header />
				<ExplorePageClient />
			</div>
		</ToastProvider>
	);
}
