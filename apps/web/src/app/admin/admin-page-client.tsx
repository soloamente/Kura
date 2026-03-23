"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import {
	AdminConsole,
	type AdminAchievementListResponse,
	type AdminOverviewResponse,
	type AdminUserListResponse,
} from "./admin-console";

export function AdminPageClient() {
	const router = useRouter();
	const [state, setState] = useState<
		| { status: "loading" }
		| { status: "error"; message: string }
		| {
				status: "ready";
				overview: AdminOverviewResponse;
				users: AdminUserListResponse["users"];
				achievements: AdminAchievementListResponse["achievements"];
		  }
	>({ status: "loading" });

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const base = process.env.NEXT_PUBLIC_SERVER_URL;
			if (!base) {
				setState({
					status: "error",
					message: "NEXT_PUBLIC_SERVER_URL is not configured",
				});
				return;
			}
			const fetchOpts: RequestInit = { credentials: "include", cache: "no-store" };
			const [adminRes, usersRes, achievementsRes] = await Promise.all([
				fetch(`${base}/admin/me`, fetchOpts),
				fetch(`${base}/admin/users`, fetchOpts),
				fetch(`${base}/admin/achievements`, fetchOpts),
			]);
			if (cancelled) return;
			if (
				adminRes.status === 401 ||
				usersRes.status === 401 ||
				achievementsRes.status === 401
			) {
				router.replace("/login");
				return;
			}
			if (
				adminRes.status === 403 ||
				usersRes.status === 403 ||
				achievementsRes.status === 403
			) {
				router.replace("/dashboard");
				return;
			}
			if (!adminRes.ok || !usersRes.ok || !achievementsRes.ok) {
				setState({
					status: "error",
					message: "Failed to load admin overview",
				});
				return;
			}
			const adminOverview = (await adminRes.json()) as AdminOverviewResponse;
			const adminUsers = (await usersRes.json()) as AdminUserListResponse;
			const adminAchievements =
				(await achievementsRes.json()) as AdminAchievementListResponse;
			setState({
				status: "ready",
				overview: adminOverview,
				users: adminUsers.users,
				achievements: adminAchievements.achievements,
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [router]);

	return (
		<AuthGate>
			{state.status === "loading" && (
				<div className="flex min-h-screen items-center justify-center bg-background">
					<p className="text-muted-foreground text-sm">Loading…</p>
				</div>
			)}
			{state.status === "error" && (
				<div className="flex min-h-screen items-center justify-center bg-background">
					<p className="text-destructive text-sm">{state.message}</p>
				</div>
			)}
			{state.status === "ready" && (
				<AdminConsole
					initialOverview={state.overview}
					initialUsers={state.users}
					initialAchievements={state.achievements}
				/>
			)}
		</AuthGate>
	);
}
