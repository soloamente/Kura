import type { Metadata } from "next";

import { AdminPageClient } from "@/app/admin/admin-page-client";

export const metadata: Metadata = {
	title: "Admin · Cura",
	robots: { index: false, follow: false },
};

export default function AdminPage() {
	return <AdminPageClient />;
}
