"use client";

import { Toaster } from "@Kura/ui/components/sonner";
import { useToast } from "@Kura/ui/components/toast";
import { DialRoot } from "dialkit";
import "dialkit/styles.css";

import { ToastProvider } from "@Kura/ui/components/toast";
import { Agentation } from "agentation";
import { useEffect, useRef } from "react";
import { getAchievementCategoryHue } from "@/components/achievement-badge";
import {
	getBadgeCelebrationVisuals,
	getNewlyUnlockedBadges,
} from "@/lib/badge-unlock-celebration";

import { ThemeProvider } from "./theme-provider";

interface UserBadgesResponse {
	catalog: Array<{
		id: string;
		name: string;
		icon: string;
		xp: number;
		isUnlocked: boolean;
		celebration: "subtle" | "rare" | "epic";
	}>;
}

function BadgeUnlockWatcher() {
	const { celebrateBadge } = useToast();
	const hasLoadedInitialBadgesRef = useRef(false);
	const seenUnlockedIdsRef = useRef<Set<string>>(new Set());
	const requestInFlightRef = useRef(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const storedBadgeIds = window.sessionStorage.getItem("kura:seen-badges");
		if (storedBadgeIds) {
			try {
				seenUnlockedIdsRef.current = new Set(
					JSON.parse(storedBadgeIds) as string[],
				);
			} catch {
				seenUnlockedIdsRef.current = new Set();
			}
		}

		const syncBadges = async () => {
			if (requestInFlightRef.current) return;
			requestInFlightRef.current = true;

			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/badges`,
					{ credentials: "include" },
				);
				if (!res.ok) return;

				const data = (await res.json()) as UserBadgesResponse;
				const unlockedIds = data.catalog
					.filter((badge) => badge.isUnlocked)
					.map((badge) => badge.id);

				if (!hasLoadedInitialBadgesRef.current) {
					hasLoadedInitialBadgesRef.current = true;
					seenUnlockedIdsRef.current = new Set(unlockedIds);
					window.sessionStorage.setItem(
						"kura:seen-badges",
						JSON.stringify(unlockedIds),
					);
					return;
				}

				const newlyUnlocked = getNewlyUnlockedBadges(
					data.catalog,
					seenUnlockedIdsRef.current,
				);

				for (const badge of newlyUnlocked) {
					celebrateBadge({
						name: badge.name,
						xp: badge.xp,
						celebration: badge.celebration,
						visuals: getBadgeCelebrationVisuals(badge.celebration),
						icon: badge.icon,
						hue: getAchievementCategoryHue(badge.icon),
					});
				}

				seenUnlockedIdsRef.current = new Set(unlockedIds);
				window.sessionStorage.setItem(
					"kura:seen-badges",
					JSON.stringify(unlockedIds),
				);
			} catch {
				// Badge celebrations should stay non-blocking if the endpoint is unavailable.
			} finally {
				requestInFlightRef.current = false;
			}
		};

		void syncBadges();

		const intervalId = window.setInterval(syncBadges, 5000);
		const handleRefresh = () => {
			void syncBadges();
		};
		window.addEventListener("kura:refresh-badges", handleRefresh);

		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener("kura:refresh-badges", handleRefresh);
		};
	}, [celebrateBadge]);

	return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider>
			<ToastProvider>
				<BadgeUnlockWatcher />
				{children}
				<Toaster richColors />
				{process.env.NODE_ENV === "development" && (
					<>
						<Agentation />
						<DialRoot position="top-right" />
					</>
				)}
			</ToastProvider>
		</ThemeProvider>
	);
}
