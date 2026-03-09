import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import Dashboard from "./dashboard";
import { Header } from "@/components/header/header";
import { CollectionProvider } from "@/context/collection-context";

export default async function DashboardPage() {
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
		<CollectionProvider>
			<div className="flex h-screen flex-col">
				<Header />
				<Dashboard />
			</div>
		</CollectionProvider>
	);
}
