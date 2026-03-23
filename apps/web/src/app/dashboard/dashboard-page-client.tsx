"use client";

import { ToastProvider } from "@Kura/ui/components/toast";
import { useEffect, useState } from "react";
import { Header } from "@/components/header/header";
import { AuthGate } from "@/components/auth-gate";
import { CollectionProvider } from "@/context/collection-context";
import { authClient } from "@/lib/auth-client";
import Dashboard from "./dashboard";
import { DashboardShell } from "./dashboard-shell";

interface MeProfile {
	username?: string | null;
}

export function DashboardPageClient() {
	const [userName, setUserName] = useState("");
	const [needsUsername, setNeedsUsername] = useState(true);
	const [profileReady, setProfileReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const { data: session } = await authClient.getSession();
			if (cancelled || !session?.user) return;

			setUserName(session.user.name ?? "");

			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me`,
					{ credentials: "include", cache: "no-store" },
				);
				const profile = res.ok ? ((await res.json()) as MeProfile) : null;
				if (cancelled) return;
				setNeedsUsername(!profile?.username);
			} finally {
				if (!cancelled) setProfileReady(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<AuthGate>
			{!profileReady ? (
				<div className="flex min-h-screen items-center justify-center bg-background">
					<p className="text-muted-foreground text-sm">Loading…</p>
				</div>
			) : (
				<CollectionProvider>
					<ToastProvider>
						<div className="flex h-screen flex-col">
							<Header />
							<DashboardShell
								needsUsername={needsUsername}
								userName={userName}
							>
								<Dashboard />
							</DashboardShell>
						</div>
					</ToastProvider>
				</CollectionProvider>
			)}
		</AuthGate>
	);
}
