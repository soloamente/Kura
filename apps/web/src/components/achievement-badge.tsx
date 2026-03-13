"use client";

import { GoldStar } from "@Kura/ui/components/GoldStar";
import { cn } from "@Kura/ui/lib/utils";
import {
	BookmarkPlus,
	BookOpen,
	Clock,
	Flame,
	FolderHeart,
	Library,
	Lock,
	Shield,
	Trophy,
	Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AchievementBadgeData {
	id: string;
	name: string;
	description: string;
	icon: string;
	xp: number;
	celebration?: "subtle" | "rare" | "epic";
	tier?: number;
	current?: number;
	target?: number;
	progress?: number;
	isUnlocked?: boolean;
	unlockedAt?: string | null;
}

// ─── Category Color System ────────────────────────────────────────────────────
// Each achievement category has a unique OKLCH hue so badges are visually
// distinct at a glance. Colors adapt to light/dark via Tailwind's opacity
// utilities — we only need the hue value.

const CATEGORY_HUES: Record<string, number> = {
	"bookmark-plus": 210, // blue — first bookmark
	"bookmark-stack-1": 210, // blue — collector tier 1
	"bookmark-stack-2": 210, // blue — collector tier 2
	star: 45, // amber — favorites
	"book-open": 155, // emerald — reading
	users: 270, // violet — social / followers
	"flame-1": 25, // orange — streaks
	"collection-follow": 340, // rose — curating
	clock: 240, // indigo — account age
	trophy: 50, // gold — XP / level
	shield: 270, // violet — admin grants
};

const DEFAULT_HUE = 220;

/** Returns the OKLCH hue for a badge's icon category. */
export function getAchievementCategoryHue(icon: string): number {
	return CATEGORY_HUES[icon] ?? DEFAULT_HUE;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

export function AchievementIcon({
	icon,
	className,
}: {
	icon: string;
	className?: string;
}) {
	switch (icon) {
		case "bookmark-plus":
			return <BookmarkPlus className={className} />;
		case "bookmark-stack-1":
			return <Library className={className} />;
		case "bookmark-stack-2":
			return <Library className={className} />;
		case "star":
			// Use the premium GoldStar asset for favorite achievements instead of the Lucide star
			return (
				<GoldStar size={20} className={className} aria-label="Achievement" />
			);
		case "users":
			return <Users className={className} />;
		case "flame-1":
			return <Flame className={className} />;
		case "book-open":
			return <BookOpen className={className} />;
		case "collection-follow":
			return <FolderHeart className={className} />;
		case "clock":
			return <Clock className={className} />;
		case "trophy":
			return <Trophy className={className} />;
		case "shield":
			return <Shield className={className} />;
		default:
			return <Lock className={className} />;
	}
}

// ─── Badge Card ───────────────────────────────────────────────────────────────

export function AchievementBadgeCard({
	badge,
	className,
}: {
	badge: AchievementBadgeData;
	className?: string;
}) {
	const isUnlocked = badge.isUnlocked ?? true;
	const hue = getAchievementCategoryHue(badge.icon);

	// Category-colored inline styles for the icon container and progress bar.
	// Using OKLCH so hues look perceptually even across categories.
	const _iconBg = isUnlocked ? `oklch(0.25 0.06 ${hue})` : undefined;
	const _iconBorder = isUnlocked ? `oklch(0.40 0.08 ${hue} / 0.35)` : undefined;
	const iconColor = isUnlocked ? `oklch(0.75 0.14 ${hue})` : undefined;
	const progressColor = isUnlocked ? `oklch(0.65 0.16 ${hue})` : undefined;
	const glowColor = isUnlocked ? `oklch(0.55 0.14 ${hue} / 0.10)` : undefined;

	return (
		<div
			className={cn(
				"group/badge relative items-center justify-center overflow-hidden rounded-2xl border p-4 transition-all duration-200",
				isUnlocked
					? "border-border/60 bg-card text-foreground"
					: "border-border/40 bg-muted/20 text-muted-foreground",
				className,
			)}
			style={
				isUnlocked
					? {
							// subtle category-tinted top glow line
							boxShadow: `inset 0 1px 0 0 ${glowColor}, 0 0 0 0 transparent`,
						}
					: undefined
			}
		>
			{/* Subtle radial glow behind unlocked badges */}
			{isUnlocked && (
				<div
					className="pointer-events-none absolute -top-8 left-1/2 h-16 w-3/4 -translate-x-1/2 rounded-full opacity-60 blur-2xl"
					style={{ background: `oklch(0.55 0.14 ${hue} / 0.12)` }}
				/>
			)}

			<div className="relative flex items-center justify-center gap-3">
				<div
					className={cn(
						"flex items-center justify-center",
						!isUnlocked && "text-muted-foreground",
					)}
					style={
						isUnlocked
							? {
									color: iconColor,
								}
							: undefined
					}
				>
					<AchievementIcon icon={badge.icon} className="size-14" />
				</div>
			</div>

			<div className="relative mt-4 space-y-1 text-center">
				<p className="font-semibold leading-none">{badge.name}</p>
				<p
					className={cn(
						"text-xs leading-relaxed",
						isUnlocked ? "text-muted-foreground" : "text-muted-foreground/70",
					)}
				>
					{badge.description}
				</p>
			</div>

			{typeof badge.progress === "number" &&
				typeof badge.current === "number" &&
				typeof badge.target === "number" && (
					<div className="relative mt-4 space-y-2">
						<div className="flex items-center justify-between text-[11px] text-muted-foreground [font-variant-numeric:tabular-nums]">
							<span>
								{Math.min(badge.current, badge.target)} / {badge.target}
							</span>
							<span>{Math.round(badge.progress * 100)}%</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-full bg-border/40">
							<div
								className="h-full rounded-full transition-[width] duration-500 ease-out"
								style={{
									width: `${Math.max(6, badge.progress * 100)}%`,
									background: isUnlocked
										? progressColor
										: "oklch(0.55 0 0 / 0.3)",
								}}
							/>
						</div>
					</div>
				)}
		</div>
	);
}

// ─── Badge Chip (profile / compact) ──────────────────────────────────────────

export function AchievementBadgeChip({
	badge,
	className,
	variant = "default",
}: {
	badge: AchievementBadgeData;
	className?: string;
	/** When used on profile, we sometimes want just the icon without the pill wrap. */
	variant?: "default" | "icon-only";
}) {
	const hue = getAchievementCategoryHue(badge.icon);

	if (variant === "icon-only") {
		// Profile header: icon only, no pill or background wrap.
		return (
			<span
				className={cn("inline-flex items-center justify-center", className)}
				style={{ color: `oklch(0.75 0.14 ${hue})` }}
				title={badge.name}
			>
				<AchievementIcon icon={badge.icon} className="size-7" />
			</span>
		);
	}

	return (
		<div
			className={cn(
				"inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-sm backdrop-blur-sm transition-colors",
				className,
			)}
		>
			<span
				className="flex size-6 items-center justify-center rounded-full"
				style={{
					background: `oklch(0.25 0.06 ${hue})`,
					color: `oklch(0.75 0.14 ${hue})`,
				}}
			>
				<AchievementIcon icon={badge.icon} className="size-3.5" />
			</span>
			<span className="font-medium">{badge.name}</span>
		</div>
	);
}
