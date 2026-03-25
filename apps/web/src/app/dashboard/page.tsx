import type { Metadata } from "next";

import { DashboardPageClient } from "@/app/dashboard/dashboard-page-client";

export const metadata: Metadata = {
	title: "Dashboard · Cura",
	description: "Your bookmarks and collections on Cura.",
};

export default function DashboardPage() {
	return <DashboardPageClient />;
}
