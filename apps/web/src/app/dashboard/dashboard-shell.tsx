"use client";

import { useState } from "react";
import { UsernameOnboarding } from "@/components/username-onboarding";

export function DashboardShell({
	children,
	needsUsername,
	userName,
}: {
	children: React.ReactNode;
	needsUsername: boolean;
	userName: string;
}) {
	const [showOnboarding, setShowOnboarding] = useState(needsUsername);

	if (showOnboarding) {
		return (
			<UsernameOnboarding
				name={userName}
				onComplete={() => setShowOnboarding(false)}
			/>
		);
	}

	return <>{children}</>;
}
