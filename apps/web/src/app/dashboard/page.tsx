import { ToastProvider } from "@Kura/ui/components/toast";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/app/dashboard/dashboard-shell";
import { Header } from "@/components/header/header";
import { CollectionProvider } from "@/context/collection-context";
import { authClient } from "@/lib/auth-client";
import Dashboard from "./dashboard";

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

	// fetch full user profile to check if username is set
	const profileRes = await fetch(
		`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me`,
		{
			headers: Object.fromEntries(await headers()),
			cache: "no-store",
		},
	);

	const profile = profileRes.ok ? await profileRes.json() : null;
	const needsUsername = !profile?.username;

	return (
		<CollectionProvider>
			<ToastProvider>
				<div className="flex h-screen flex-col">
					<Header />
					<DashboardShell
						needsUsername={needsUsername}
						userName={session.user.name}
					>
						<Dashboard />
					</DashboardShell>
				</div>
			</ToastProvider>
		</CollectionProvider>
	);
}
