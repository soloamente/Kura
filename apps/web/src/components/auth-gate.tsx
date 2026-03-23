"use client";

/**
 * Cross-origin auth: the session cookie lives on the API host (NEXT_PUBLIC_SERVER_URL).
 * Server Components never receive that cookie, so RSC `getSession({ headers })` always
 * looks logged-out. This gate runs in the browser where `credentials: "include"` works.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthGate({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	const [allowed, setAllowed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const { data } = await authClient.getSession();
			if (cancelled) return;
			if (!data?.user) {
				router.replace("/login");
				return;
			}
			setAllowed(true);
			setReady(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [router]);

	if (!ready) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground text-sm">Loading…</p>
			</div>
		);
	}

	if (!allowed) {
		return null;
	}

	return <>{children}</>;
}
