import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
	type AdminAchievementListResponse,
	AdminConsole,
	type AdminOverviewResponse,
	type AdminUserListResponse,
} from "./admin-console";

export default async function AdminPage() {
	const requestHeaders = await headers();
	const forwardedHeaders = Object.fromEntries(requestHeaders);
	const session = await authClient.getSession({
		fetchOptions: {
			headers: requestHeaders,
			throw: true,
		},
	});

	if (!session?.user) {
		redirect("/login");
	}

	const adminRes = await fetch(
		`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/me`,
		{
			headers: forwardedHeaders,
			cache: "no-store",
		},
	);
	const usersRes = await fetch(
		`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/users`,
		{
			headers: forwardedHeaders,
			cache: "no-store",
		},
	);
	const achievementsRes = await fetch(
		`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/achievements`,
		{
			headers: forwardedHeaders,
			cache: "no-store",
		},
	);

	if (
		adminRes.status === 401 ||
		usersRes.status === 401 ||
		achievementsRes.status === 401
	) {
		redirect("/login");
	}

	if (
		adminRes.status === 403 ||
		usersRes.status === 403 ||
		achievementsRes.status === 403
	) {
		redirect("/dashboard");
	}

	if (!adminRes.ok || !usersRes.ok || !achievementsRes.ok) {
		throw new Error("Failed to load admin overview");
	}

	const adminOverview = (await adminRes.json()) as AdminOverviewResponse;
	const adminUsers = (await usersRes.json()) as AdminUserListResponse;
	const adminAchievements =
		(await achievementsRes.json()) as AdminAchievementListResponse;

	return (
		<AdminConsole
			initialOverview={adminOverview}
			initialUsers={adminUsers.users}
			initialAchievements={adminAchievements.achievements}
		/>
	);
}
