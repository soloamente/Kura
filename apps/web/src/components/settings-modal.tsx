"use client";

import { useToast } from "@Kura/ui/components/toast";
import { cn } from "@Kura/ui/lib/utils";
import { Tooltip } from "@base-ui/react/tooltip";
import { Flame, Shield, Zap } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	AchievementBadgeCard,
	type AchievementBadgeData,
} from "@/components/achievement-badge";
import {
	type ColorMode,
	type Density,
	type ThemeName,
	useTheme,
} from "@/components/theme-provider";
import { useCollection } from "@/context/collection-context";
import { env } from "@Kura/env/web";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = "profile" | "appearance" | "friends" | "account" | "badges";

interface UserProfile {
	id: string;
	name: string;
	email: string;
	username: string | null;
	bio: string | null;
	image: string | null;
	banner: string | null;
}

interface UserBadgesResponse {
	catalog: Array<
		AchievementBadgeData & {
			current: number;
			target: number;
			progress: number;
			isUnlocked: boolean;
			unlockedAt: string | null;
		}
	>;
	stats: {
		totalXp: number;
		level: number;
		currentDailyStreak: number;
	};
}

// ─── Theme definitions ────────────────────────────────────────────────────────

const THEMES: { id: ThemeName; label: string; light: string; dark: string }[] =
	[
		{
			id: "default",
			label: "Default",
			light: "oklch(1 0 0)",
			dark: "oklch(0.145 0 0)",
		},
		{
			id: "nord",
			label: "Nord",
			light: "oklch(0.97 0.008 240)",
			dark: "oklch(0.22 0.02 240)",
		},
		{
			id: "rose",
			label: "Rosé",
			light: "oklch(0.99 0.005 10)",
			dark: "oklch(0.16 0.018 340)",
		},
		{
			id: "midnight",
			label: "Midnight",
			light: "oklch(0.96 0.006 260)",
			dark: "oklch(0.13 0.025 260)",
		},
		{
			id: "forest",
			label: "Forest",
			light: "oklch(0.98 0.006 150)",
			dark: "oklch(0.14 0.028 150)",
		},
		{
			id: "amber",
			label: "Amber",
			light: "oklch(0.99 0.006 80)",
			dark: "oklch(0.15 0.025 60)",
		},
		{
			id: "mono",
			label: "Mono",
			light: "oklch(1 0 0)",
			dark: "oklch(0.08 0 0)",
		},
	];

const ACCENT_HUES: { hue: number; label: string }[] = [
	{ hue: 0, label: "Red" },
	{ hue: 27, label: "Orange" },
	{ hue: 65, label: "Amber" },
	{ hue: 130, label: "Green" },
	{ hue: 150, label: "Teal" },
	{ hue: 220, label: "Blue" },
	{ hue: 240, label: "Indigo" },
	{ hue: 270, label: "Violet" },
	{ hue: 300, label: "Purple" },
	{ hue: 340, label: "Pink" },
];

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

function NavItem({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"w-full cursor-pointer rounded-lg px-3 py-2 text-left font-medium text-sm transition-colors",
				active
					? "bg-primary/10 text-primary"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection({
	profile,
	onDirtyChange,
	unsavedWarning,
	onDiscardAndClose,
	onProfileSaved,
}: {
	profile: UserProfile;
	onDirtyChange: (dirty: boolean) => void;
	unsavedWarning: boolean;
	onDiscardAndClose: () => void;
	// notify parent when a save succeeds so it can update the "baseline" profile,
	// which keeps the unsaved-changes guard in sync with what is actually stored
	onProfileSaved: (next: Partial<UserProfile>) => void;
}) {
	const { toast } = useToast();
	const [name, setName] = useState(profile.name);
	const [username, setUsername] = useState(profile.username ?? "");
	const [bio, setBio] = useState(profile.bio ?? "");
	const [avatarUrl, setAvatarUrl] = useState(profile.image ?? "");
	const [bannerUrl, setBannerUrl] = useState(profile.banner ?? "");
	const [uploadingAvatar, setUploadingAvatar] = useState(false);
	const [uploadingBanner, setUploadingBanner] = useState(false);
	const avatarInputRef = useRef<HTMLInputElement | null>(null);
	const bannerInputRef = useRef<HTMLInputElement | null>(null);
	const [usernameStatus, setUsernameStatus] = useState<
		"idle" | "checking" | "taken" | "available"
	>("idle");
	const [saving, setSaving] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const originalUsername = profile.username ?? "";

	// notify parent whenever dirty state changes
	const isDirty =
		name !== profile.name ||
		username !== (profile.username ?? "") ||
		bio !== (profile.bio ?? "") ||
		avatarUrl !== (profile.image ?? "") ||
		bannerUrl !== (profile.banner ?? "");

	useEffect(() => {
		onDirtyChange(isDirty);
	}, [isDirty, onDirtyChange]);

	useEffect(() => {
		if (username === originalUsername || username.length < 2) {
			setUsernameStatus("idle");
			return;
		}
		setUsernameStatus("checking");
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(async () => {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${username}`,
				{ credentials: "include" },
			);
			setUsernameStatus(res.status === 404 ? "available" : "taken");
		}, 400);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [username, originalUsername]);

	// upload to R2 and stage the URL locally — DB is only updated on Save
	const handleImageUpload = async (file: File, type: "avatar" | "banner") => {
		const setUploading =
			type === "avatar" ? setUploadingAvatar : setUploadingBanner;
		setUploading(true);
		const form = new FormData();
		form.append("file", file);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/upload?type=${type}`,
				{ method: "POST", credentials: "include", body: form },
			);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				toast(
					(err as { message?: string }).message ?? "Upload failed",
					"error",
				);
				return;
			}
			const { url } = await res.json();
			if (type === "avatar") setAvatarUrl(url);
			else setBannerUrl(url);
			// no toast here — the change is staged, not saved yet
		} catch {
			toast("Upload failed", "error");
		} finally {
			setUploading(false);
		}
	};

	const handleSave = async () => {
		if (usernameStatus === "taken") return;
		setSaving(true);
		// compute the next persisted values so we can both send them to the server
		// and update the parent baseline on success (keeps dirty tracking accurate)
		const nextName = name.trim() || profile.name;
		const nextUsername = username.trim() || null;
		const nextBio = bio.trim() || null;
		const nextImage = avatarUrl || null;
		const nextBanner = bannerUrl || null;
		// include staged avatar and banner URLs in the same PATCH
		const { error } = await api.users.me.patch({
			name: nextName === profile.name ? undefined : nextName,
			username: nextUsername,
			bio: nextBio,
			image: nextImage,
			banner: nextBanner,
		});
		if (error) {
			toast("Failed to save profile", "error");
		} else {
			toast("Profile saved", "success");
			// let the parent know the profile has been saved so it can
			// update its copy and reset the dirty state baseline
			onProfileSaved({
				name: nextName,
				username: nextUsername,
				bio: nextBio,
				image: nextImage,
				banner: nextBanner,
			});
		}
		setSaving(false);
	};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="font-semibold text-base text-foreground">Profile</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					How you appear to others on Kura.
				</p>
			</div>

			{/* Banner + Avatar stack */}
			<div className="flex flex-col gap-3">
				{/* Banner */}
				<div className="relative">
					<div
						className={cn(
							"relative h-28 w-full overflow-hidden rounded-xl bg-muted",
							"transition-[filter] duration-150 [@media(hover:hover)]:hover:brightness-90",
						)}
					>
						{bannerUrl ? (
							// biome-ignore lint/performance/noImgElement: user-uploaded banner URL, blob/remote
							<img
								src={bannerUrl}
								alt="Banner"
								className="size-full object-cover"
								onError={() => setBannerUrl("")}
							/>
						) : (
							<div className="size-full bg-gradient-to-br from-primary/20 to-primary/5" />
						)}

						{/* hidden file input */}
						<input
							ref={bannerInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) handleImageUpload(file, "banner");
								e.target.value = "";
							}}
						/>

						{/* overlay button */}
						<button
							type="button"
							onClick={() => bannerInputRef.current?.click()}
							disabled={uploadingBanner}
							className="absolute inset-0 flex cursor-pointer select-none items-center justify-center gap-2 bg-black/30 font-medium text-white text-xs opacity-0 transition-opacity [@media(hover:hover)]:hover:opacity-100"
						>
							{uploadingBanner ? (
								<svg
									className="animate-spin"
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									aria-hidden="true"
								>
									<circle
										cx="7"
										cy="7"
										r="5.5"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeDasharray="22 10"
										strokeLinecap="round"
									/>
								</svg>
							) : (
								<svg
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									aria-hidden="true"
								>
									<path
										d="M7 2v8M3 6l4-4 4 4M2 12h10"
										stroke="currentColor"
										strokeWidth="1.4"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							)}
							{uploadingBanner ? "Uploading…" : "Change banner"}
						</button>
					</div>

					{/* Avatar overlapping the banner */}
					<div className="absolute -bottom-6 left-4">
						<div className="relative">
							{/* clickable avatar with hover overlay, same pattern as banner */}
							<button
								type="button"
								aria-label="Change avatar"
								onClick={() => avatarInputRef.current?.click()}
								disabled={uploadingAvatar}
								className="relative flex size-16 shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden rounded-full bg-muted ring-4 ring-popover"
							>
								{avatarUrl ? (
									// biome-ignore lint/performance/noImgElement: user-uploaded avatar URL, blob/remote
									<img
										src={avatarUrl}
										alt={name}
										className="size-full object-cover"
										onError={() => setAvatarUrl("")}
									/>
								) : (
									<span className="font-bold text-primary text-xl">
										{name.charAt(0).toUpperCase()}
									</span>
								)}

								{/* hover overlay */}
								{!uploadingAvatar && (
									<span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity [@media(hover:hover)]:hover:opacity-100">
										<svg
											width="14"
											height="14"
											viewBox="0 0 14 14"
											fill="none"
											aria-hidden="true"
										>
											<path
												d="M7 2v8M3 6l4-4 4 4M2 12h10"
												stroke="currentColor"
												strokeWidth="1.4"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</span>
								)}

								{/* upload spinner */}
								{uploadingAvatar && (
									<span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
										<svg
											className="animate-spin text-white"
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											aria-hidden="true"
										>
											<circle
												cx="8"
												cy="8"
												r="6"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeDasharray="24 12"
												strokeLinecap="round"
											/>
										</svg>
									</span>
								)}
							</button>

							{/* hidden file input */}
							<input
								ref={avatarInputRef}
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								className="hidden"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) handleImageUpload(file, "avatar");
									e.target.value = "";
								}}
							/>
						</div>
					</div>
				</div>

				{/* spacer for the overlapping avatar */}
				<div className="h-8" />
			</div>

			{/* Name */}
			<Field label="Display name">
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</Field>

			{/* Username */}
			<Field
				label="Username"
				hint={`${username || "…"}.${env.NEXT_PUBLIC_PROFILE_DOMAIN}`}
			>
				<div className="relative">
					<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
						@
					</span>
					<input
						type="text"
						value={username}
						onChange={(e) =>
							setUsername(
								e.target.value
									.toLowerCase()
									.replace(/[^a-z0-9_]/g, "")
									.slice(0, 24),
							)
						}
						className="h-9 w-full rounded-lg border border-border bg-muted/40 pr-8 pl-7 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
					<span className="absolute top-1/2 right-2.5 -translate-y-1/2">
						{usernameStatus === "checking" && (
							// biome-ignore lint/a11y/noSvgWithoutTitle: decorative status icon, aria-hidden
							<svg
								className="animate-spin text-muted-foreground"
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								aria-hidden
							>
								<circle
									cx="6"
									cy="6"
									r="4.5"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeDasharray="18 10"
									strokeLinecap="round"
								/>
							</svg>
						)}
						{usernameStatus === "available" && (
							// biome-ignore lint/a11y/noSvgWithoutTitle: decorative status icon, aria-hidden
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								className="text-emerald-500"
								aria-hidden
							>
								<circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.2" />
								<path
									d="M3 6l2 2 4-4"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
						{usernameStatus === "taken" && (
							// biome-ignore lint/a11y/noSvgWithoutTitle: decorative status icon, aria-hidden
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								className="text-destructive"
								aria-hidden
							>
								<circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.2" />
								<path
									d="M4 4l4 4M8 4l-4 4"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						)}
					</span>
				</div>
				{usernameStatus === "taken" && (
					<p className="text-destructive text-xs">Username already taken.</p>
				)}
			</Field>

			{/* Bio */}
			<Field label="Bio">
				<textarea
					value={bio}
					onChange={(e) => setBio(e.target.value)}
					maxLength={160}
					rows={3}
					placeholder="A short bio about yourself…"
					className="w-full resize-none rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				<p className="text-right text-[11px] text-muted-foreground">
					{bio.length}/160
				</p>
			</Field>

			{/* button row — Cancel + warning text animate in when a close was attempted with unsaved changes */}
			<div className="ml-auto flex items-center gap-3">
				<AnimatePresence>
					{unsavedWarning && (
						<motion.span
							key="unsaved-warning-text"
							className="select-none font-medium text-destructive text-sm"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							aria-live="polite"
						>
							{"Unsaved changes".split("").map((char, i) => (
								<motion.span
									key={i}
									initial={{ opacity: 0, filter: "blur(4px)" }}
									animate={{ opacity: 1, filter: "blur(0px)" }}
									transition={{
										duration: 0.25,
										delay: i * 0.018,
										ease: "easeOut",
									}}
								>
									{char === " " ? "\u00a0" : char}
								</motion.span>
							))}
						</motion.span>
					)}
				</AnimatePresence>

				<AnimatePresence>
					{unsavedWarning && (
						<motion.button
							type="button"
							onClick={onDiscardAndClose}
							initial={{ opacity: 0, x: 10, scale: 0.95 }}
							animate={{ opacity: 1, x: 0, scale: 1 }}
							exit={{ opacity: 0, x: 10, scale: 0.95 }}
							transition={{ type: "spring", stiffness: 420, damping: 28 }}
							className="h-9 cursor-pointer select-none rounded-lg border border-border px-4 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted"
						>
							Cancel
						</motion.button>
					)}
				</AnimatePresence>

				<button
					type="button"
					onClick={handleSave}
					disabled={saving || usernameStatus === "taken"}
					className="h-9 cursor-pointer rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{saving ? "Saving…" : "Save profile"}
				</button>
			</div>
		</div>
	);
}

// ─── Badges section ───────────────────────────────────────────────────────────

// Stat card variants for the badges overview
const STAT_CARDS = [
	{ key: "level", label: "Level", Icon: Shield, hue: 270 },
	{ key: "totalXp", label: "Total XP", Icon: Zap, hue: 50 },
	{ key: "currentDailyStreak", label: "Current streak", Icon: Flame, hue: 25 },
] as const;

// Stagger animation for the badge grid
const badgeGridVariants = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.04 } },
};

const badgeItemVariants = {
	hidden: { opacity: 0, y: 8 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.25, ease: "easeOut" as const },
	},
};

function BadgesSection() {
	const { toast } = useToast();
	const [payload, setPayload] = useState<UserBadgesResponse | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		const loadBadges = async () => {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/badges`,
					{ credentials: "include" },
				);
				if (!res.ok) {
					throw new Error("Failed to load badges");
				}

				const data = (await res.json()) as UserBadgesResponse;
				if (!cancelled) {
					setPayload(data);
				}
			} catch {
				if (!cancelled) {
					toast("Failed to load badges", "error");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void loadBadges();

		return () => {
			cancelled = true;
		};
	}, [toast]);

	if (loading) {
		return (
			<div className="flex flex-col gap-6">
				<div>
					<h2 className="font-semibold text-base text-foreground">Badges</h2>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Track your earned achievements and what to unlock next.
					</p>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{Array.from({ length: 6 }).map((_, index) => (
						<div
							key={index}
							className="h-36 animate-pulse rounded-2xl border border-border bg-muted/40"
						/>
					))}
				</div>
			</div>
		);
	}

	if (!payload) {
		return (
			<div className="flex flex-col gap-6">
				<div>
					<h2 className="font-semibold text-base text-foreground">Badges</h2>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Track your earned achievements and what to unlock next.
					</p>
				</div>
				<p className="text-muted-foreground text-sm">
					Badges are unavailable right now.
				</p>
			</div>
		);
	}

	// Sort: unlocked first, then locked
	const unlockedBadges = payload.catalog.filter((b) => b.isUnlocked);
	const lockedBadges = payload.catalog.filter((b) => !b.isUnlocked);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="font-semibold text-base text-foreground">Badges</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Unlocked badges stay vivid. Locked ones stay muted until you earn
					them.
				</p>
			</div>

			{/* Stats overview with category-colored icons */}
			<div className="grid gap-3 md:grid-cols-3">
				{STAT_CARDS.map(({ key, label, Icon, hue }) => (
					<div
						key={key}
						className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-4"
					>
						{/* Thin top glow line */}
						<div
							className="pointer-events-none absolute inset-x-0 top-0 h-px"
							style={{
								background: `linear-gradient(90deg, transparent, oklch(0.65 0.14 ${hue} / 0.35), transparent)`,
							}}
						/>
						<div className="flex items-center gap-2.5">
							<span
								className="flex size-7 items-center justify-center rounded-lg"
								style={{
									background: `oklch(0.25 0.06 ${hue})`,
									color: `oklch(0.75 0.14 ${hue})`,
								}}
							>
								<Icon className="size-3.5" />
							</span>
							<p className="text-muted-foreground text-xs">{label}</p>
						</div>
						<p className="mt-2 font-semibold text-2xl text-foreground [font-variant-numeric:tabular-nums]">
							{payload.stats[key]}
						</p>
					</div>
				))}
			</div>

			{/* Unlocked badges */}
			{unlockedBadges.length > 0 && (
				<motion.div
					className="grid grid-cols-1 gap-3 md:grid-cols-2"
					variants={badgeGridVariants}
					initial="hidden"
					animate="visible"
				>
					{unlockedBadges.map((badge) => (
						<motion.div key={badge.id} variants={badgeItemVariants}>
							<Tooltip.Root>
								<Tooltip.Trigger
									render={
										<button
											type="button"
											className="w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
											aria-label={`${badge.name}. ${badge.description}`}
										/>
									}
								>
									<AchievementBadgeCard badge={badge} />
								</Tooltip.Trigger>
								<Tooltip.Portal>
									<Tooltip.Positioner side="top" sideOffset={10}>
										<Tooltip.Popup className="max-w-xs rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-xl outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
											{`Unlocked${badge.unlockedAt ? ` on ${new Date(badge.unlockedAt).toLocaleDateString()}` : ""}.`}
										</Tooltip.Popup>
									</Tooltip.Positioner>
								</Tooltip.Portal>
							</Tooltip.Root>
						</motion.div>
					))}
				</motion.div>
			)}

			{/* Locked badges with divider */}
			{lockedBadges.length > 0 && (
				<>
					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-border/50" />
						<span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">
							Locked
						</span>
						<div className="h-px flex-1 bg-border/50" />
					</div>
					<motion.div
						className="grid grid-cols-1 gap-3 md:grid-cols-2"
						variants={badgeGridVariants}
						initial="hidden"
						animate="visible"
					>
						{lockedBadges.map((badge) => (
							<motion.div key={badge.id} variants={badgeItemVariants}>
								<Tooltip.Root>
									<Tooltip.Trigger
										render={
											<button
												type="button"
												className="w-full cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
												aria-label={`${badge.name}. ${badge.description}`}
											/>
										}
									>
										<AchievementBadgeCard badge={badge} />
									</Tooltip.Trigger>
									<Tooltip.Portal>
										<Tooltip.Positioner side="top" sideOffset={10}>
											<Tooltip.Popup className="max-w-xs rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-xl outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
												{`${badge.description} Progress: ${Math.min(badge.current, badge.target)} of ${badge.target}.`}
											</Tooltip.Popup>
										</Tooltip.Positioner>
									</Tooltip.Portal>
								</Tooltip.Root>
							</motion.div>
						))}
					</motion.div>
				</>
			)}
		</div>
	);
}

// ─── Friends section ──────────────────────────────────────────────────────────

interface FriendsResponse {
	friends: Array<{
		id: string;
		name: string | null;
		username: string | null;
		image: string | null;
		createdAt: string;
	}>;
	pending: {
		incoming: Array<{
			id: string;
			requesterId: string;
			createdAt: string;
			requester: {
				id: string;
				name: string | null;
				username: string | null;
			} | null;
		}>;
		outgoing: Array<{
			id: string;
			addresseeId: string;
			createdAt: string;
			addressee: {
				id: string;
				name: string | null;
				username: string | null;
			} | null;
		}>;
	};
}

interface SharedItem {
	id: string;
	createdAt: string;
	sender: {
		id: string;
		name: string | null;
		username: string | null;
		image: string | null;
	} | null;
	bookmark: {
		id: string;
		url: string;
		title: string | null;
		favicon: string | null;
		siteName: string | null;
	} | null;
	collection: {
		id: string;
		name: string;
		color: string | null;
	} | null;
}

function FriendsSection() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	// Track whether we've completed the very first load; we only want to show
	// the skeleton on that initial fetch, not on subsequent realtime refreshes.
	const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
	const [busy, setBusy] = useState(false);
	const [friendUsername, setFriendUsername] = useState("");
	const [friends, setFriends] = useState<FriendsResponse["friends"]>([]);
	const [incoming, setIncoming] = useState<
		FriendsResponse["pending"]["incoming"]
	>([]);
	const [outgoing, setOutgoing] = useState<
		FriendsResponse["pending"]["outgoing"]
	>([]);
	const [sharedWithMe, setSharedWithMe] = useState<SharedItem[]>([]);

	const load = useCallback(async () => {
		// Only flip the loading skeleton on for the very first fetch; after that
		// we treat polling as a background refresh so the UI does not flash.
		if (!hasLoadedOnce) {
			setLoading(true);
		}
		try {
			const [friendsRes, sharedRes] = await Promise.all([
				fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/friends`, {
					credentials: "include",
				}),
				fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/shared-with-me`, {
					credentials: "include",
				}),
			]);

			if (!friendsRes.ok) {
				throw new Error("Failed to load friends");
			}
			const data = (await friendsRes.json()) as FriendsResponse;
			setFriends(data.friends ?? []);
			setIncoming(data.pending?.incoming ?? []);
			setOutgoing(data.pending?.outgoing ?? []);

			if (sharedRes.ok) {
				const sharedData = (await sharedRes.json()) as SharedItem[];
				setSharedWithMe(Array.isArray(sharedData) ? sharedData : []);
			}
		} catch {
			toast("Failed to load friends", "error");
		} finally {
			if (!hasLoadedOnce) {
				setLoading(false);
				setHasLoadedOnce(true);
			}
		}
	}, [toast, hasLoadedOnce]);

	useEffect(() => {
		let cancelled = false;

		const tick = async () => {
			if (cancelled) return;
			await load();
		};

		// initial load
		void tick();

		// poll while the Friends section is mounted so incoming/outgoing
		// requests stay fresh without a full page reload.
		const id = setInterval(tick, 5_000);

		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [load]);

	const handleAddFriend = async () => {
		const username = friendUsername.trim().toLowerCase();
		if (!username) return;
		setBusy(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/friend-requests`,
				{
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ username }),
				},
			);
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as {
					message?: string;
				};
				toast(body.message ?? "Failed to send friend request", "error");
				return;
			}
			toast("Friend request sent", "success");
			setFriendUsername("");
			await load();
		} catch {
			toast("Failed to send friend request", "error");
		} finally {
			setBusy(false);
		}
	};

	const handleAcceptOrDeny = async (id: string, action: "accept" | "deny") => {
		setBusy(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/friend-requests/${id}/${action}`,
				{ method: "POST", credentials: "include" },
			);
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as {
					message?: string;
				};
				toast(body.message ?? "Failed to update request", "error");
				return;
			}
			toast(
				action === "accept"
					? "Friend request accepted"
					: "Friend request denied",
				"success",
			);
			await load();
		} catch {
			toast("Failed to update request", "error");
		} finally {
			setBusy(false);
		}
	};

	const handleRemoveFriend = async (username: string | null) => {
		if (!username) return;
		setBusy(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/friends/${encodeURIComponent(
					username,
				)}`,
				{ method: "DELETE", credentials: "include" },
			);
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as {
					message?: string;
				};
				toast(body.message ?? "Failed to remove friend", "error");
				return;
			}
			toast("Friend removed", "success");
			await load();
		} catch {
			toast("Failed to remove friend", "error");
		} finally {
			setBusy(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col gap-4">
				<h2 className="font-semibold text-base text-foreground">Friends</h2>
				<div className="flex flex-col gap-2">
					<div className="h-9 animate-pulse rounded-lg bg-muted" />
					<div className="h-9 animate-pulse rounded-lg bg-muted" />
					<div className="h-9 animate-pulse rounded-lg bg-muted" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="font-semibold text-base text-foreground">Friends</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Send friend requests, accept or deny them, and manage your friends.
				</p>
			</div>

			{/* Add friend */}
			<div className="flex flex-col gap-2 rounded-xl border border-border p-4">
				<p className="font-medium text-foreground text-sm">Add friend</p>
				<div className="flex gap-2">
					<input
						type="text"
						value={friendUsername}
						onChange={(e) =>
							setFriendUsername(
								e.target.value
									.toLowerCase()
									.replace(/[^a-z0-9_]/g, "")
									.slice(0, 24),
							)
						}
						placeholder="Friend's username"
						className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
					<button
						type="button"
						onClick={handleAddFriend}
						disabled={busy || !friendUsername.trim()}
						className="h-9 shrink-0 cursor-pointer rounded-lg bg-primary px-3 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Send
					</button>
				</div>
			</div>

			{/* Incoming requests */}
			{incoming.length > 0 && (
				<div className="flex flex-col gap-2 rounded-xl border border-border p-4">
					<p className="font-medium text-foreground text-sm">
						Incoming requests
					</p>
					<ul className="flex flex-col gap-1 text-muted-foreground text-xs">
						{incoming.map((req) => (
							<li
								key={req.id}
								className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/40"
							>
								<span>
									Request from{" "}
									{req.requester?.name ||
										(req.requester?.username
											? `@${req.requester.username}`
											: "someone")}
								</span>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => handleAcceptOrDeny(req.id, "accept")}
										disabled={busy}
										className="h-7 cursor-pointer rounded-lg bg-primary px-2 font-medium text-[11px] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
									>
										Accept
									</button>
									<button
										type="button"
										onClick={() => handleAcceptOrDeny(req.id, "deny")}
										disabled={busy}
										className="h-7 cursor-pointer rounded-lg border border-border px-2 font-medium text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
									>
										Deny
									</button>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Outgoing requests */}
			{outgoing.length > 0 && (
				<div className="flex flex-col gap-2 rounded-xl border border-border p-4">
					<p className="font-medium text-foreground text-sm">
						Outgoing requests
					</p>
					<ul className="flex flex-col gap-1 text-muted-foreground text-xs">
						{outgoing.map((req) => (
							<li
								key={req.id}
								className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/40"
							>
								<span>
									Request to{" "}
									{req.addressee?.name ||
										(req.addressee?.username
											? `@${req.addressee.username}`
											: "pending")}
								</span>
								<button
									type="button"
									onClick={async () => {
										// Allow users to withdraw a pending outgoing request.
										setBusy(true);
										try {
											const res = await fetch(
												`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/friend-requests/${req.id}`,
												{ method: "DELETE", credentials: "include" },
											);
											if (!res.ok) {
												const body = (await res.json().catch(() => ({}))) as {
													message?: string;
												};
												toast(
													body.message ?? "Failed to cancel request",
													"error",
												);
												return;
											}
											toast("Friend request cancelled", "success");
											await load();
										} catch {
											toast("Failed to cancel request", "error");
										} finally {
											setBusy(false);
										}
									}}
									disabled={busy}
									className="h-7 cursor-pointer rounded-lg border border-border px-2 font-medium text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
								>
									Cancel
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Friends */}
			<div className="flex flex-col gap-2 rounded-xl border border-border p-4">
				<p className="font-medium text-foreground text-sm">Friends</p>
				{friends.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						You haven&apos;t added any friends yet.
					</p>
				) : (
					<ul className="flex flex-col gap-1 text-sm">
						{friends.map((f) => (
							<li
								key={f.id}
								className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/40"
							>
								<span className="truncate text-foreground text-sm">
									{f.name || f.username || "Unknown"}
									{f.username && (
										<span className="ml-1 text-[11px] text-muted-foreground">
											@{f.username}
										</span>
									)}
								</span>
								<button
									type="button"
									onClick={() => handleRemoveFriend(f.username)}
									disabled={busy}
									className="h-7 cursor-pointer rounded-lg border border-border px-2 font-medium text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
								>
									Remove
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* Shared with you */}
			<div className="flex flex-col gap-2 rounded-xl border border-border p-4">
				<p className="font-medium text-foreground text-sm">Shared with you</p>
				{sharedWithMe.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						Bookmarks or collections that friends share with you will appear
						here.
					</p>
				) : (
					<ul className="flex flex-col gap-1 text-muted-foreground text-xs">
						{sharedWithMe.map((item) => {
							const senderLabel =
								item.sender?.name ||
								(item.sender?.username
									? `@${item.sender.username}`
									: "Someone");
							const kind = item.bookmark
								? "Bookmark"
								: item.collection
									? "Collection"
									: "Item";
							const title =
								item.bookmark?.title ||
								item.collection?.name ||
								item.bookmark?.url ||
								"(no title)";
							return (
								<li
									key={item.id}
									className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/40"
								>
									<div className="min-w-0">
										<p className="truncate text-foreground">
											{kind}: {title}
										</p>
										<p className="text-[11px] text-muted-foreground">
											Shared by {senderLabel}
										</p>
									</div>
									{item.bookmark?.url && (
										<button
											type="button"
											onClick={() =>
												window.open(
													item.bookmark?.url ?? "#",
													"_blank",
													"noopener,noreferrer",
												)
											}
											className="h-7 cursor-pointer rounded-lg border border-border px-2 font-medium text-[11px] text-muted-foreground transition-colors hover:bg-muted"
										>
											Open
										</button>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

// ─── Appearance section ───────────────────────────────────────────────────────

function AppearanceSection() {
	const { groupByDateAdded, setGroupByDateAdded } = useCollection();
	const {
		theme,
		colorMode,
		density,
		accentHue,
		resolvedColorMode,
		setTheme,
		setColorMode,
		setDensity,
		setAccentHue,
	} = useTheme();

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="font-semibold text-base text-foreground">Appearance</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Customize how Kura looks and feels.
				</p>
			</div>

			{/* Color mode */}
			<Field label="Color mode">
				<div className="flex gap-2">
					{(["light", "dark", "system"] as ColorMode[]).map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => setColorMode(m)}
							className={cn(
								"flex-1 cursor-pointer rounded-lg border px-3 py-2 font-medium text-sm capitalize transition-colors",
								colorMode === m
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-foreground hover:bg-muted",
							)}
						>
							{m}
						</button>
					))}
				</div>
			</Field>

			{/* Theme */}
			<Field label="Theme">
				<div className="grid grid-cols-4 gap-2">
					{THEMES.map((t) => {
						const bg = resolvedColorMode === "dark" ? t.dark : t.light;
						return (
							<button
								key={t.id}
								type="button"
								onClick={() => setTheme(t.id)}
								className={cn(
									"flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 transition-colors",
									theme === t.id
										? "border-primary"
										: "border-transparent hover:border-border",
								)}
							>
								{/* mini preview */}
								<span
									className="size-8 rounded-lg ring-1 ring-black/10"
									style={{ background: bg }}
								/>
								<span className="font-medium text-[11px] text-muted-foreground">
									{t.label}
								</span>
							</button>
						);
					})}
				</div>
			</Field>

			{/* Accent color */}
			<Field label="Accent color" hint="Overrides the theme's primary color">
				<div className="flex flex-wrap gap-2">
					{/* None option */}
					<button
						type="button"
						onClick={() => setAccentHue(null)}
						className={cn(
							"flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-colors",
							accentHue === null
								? "border-primary"
								: "border-transparent hover:border-border",
						)}
						title="Default"
					>
						<span className="size-4 rounded-full bg-primary" />
					</button>
					{ACCENT_HUES.map(({ hue, label }) => (
						<button
							key={hue}
							type="button"
							onClick={() => setAccentHue(hue)}
							className={cn(
								"size-7 cursor-pointer rounded-full border-2 transition-colors",
								accentHue === hue
									? "scale-110 border-foreground"
									: "border-transparent hover:border-border",
							)}
							style={{
								background: `oklch(0.55 0.18 ${hue})`,
							}}
							title={label}
						/>
					))}
				</div>
			</Field>

			{/* Density */}
			<Field label="List density">
				<div className="flex gap-2">
					{(["comfortable", "compact"] as Density[]).map((d) => (
						<button
							key={d}
							type="button"
							onClick={() => setDensity(d)}
							className={cn(
								"flex-1 cursor-pointer rounded-lg border px-3 py-2 font-medium text-sm capitalize transition-colors",
								density === d
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-foreground hover:bg-muted",
							)}
						>
							{d}
						</button>
					))}
				</div>
			</Field>

			{/* Bookmark grouping preference */}
			<Field
				label="Bookmark grouping"
				hint="Choose whether to group bookmarks by when they were added."
			>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setGroupByDateAdded(true)}
						className={cn(
							"flex-1 cursor-pointer rounded-lg border px-3 py-2 font-medium text-sm transition-colors",
							groupByDateAdded
								? "border-primary bg-primary/10 text-primary"
								: "border-border text-foreground hover:bg-muted",
						)}
					>
						Group by time added
					</button>
					<button
						type="button"
						onClick={() => setGroupByDateAdded(false)}
						className={cn(
							"flex-1 cursor-pointer rounded-lg border px-3 py-2 font-medium text-sm transition-colors",
							!groupByDateAdded
								? "border-primary bg-primary/10 text-primary"
								: "border-border text-foreground hover:bg-muted",
						)}
					>
						Flat list
					</button>
				</div>
			</Field>
		</div>
	);
}

// ─── Account section ──────────────────────────────────────────────────────────

function AccountSection({ profile }: { profile: UserProfile }) {
	const { toast } = useToast();
	const [email, setEmail] = useState(profile.email);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [savingEmail, setSavingEmail] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);
	const [showDanger, setShowDanger] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState("");
	const [enriching, setEnriching] = useState(false);

	const handleChangeEmail = async () => {
		setSavingEmail(true);
		const { error } = await authClient.changeEmail({ newEmail: email });
		setSavingEmail(false);
		if (error) {
			toast("Failed to update email", "error");
			return;
		}
		toast("Verification email sent", "success");
	};

	const handleChangePassword = async () => {
		if (newPassword !== confirmPassword) {
			toast("Passwords don't match", "error");
			return;
		}
		if (newPassword.length < 8) {
			toast("Password must be at least 8 characters", "error");
			return;
		}
		setSavingPassword(true);
		const { error } = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: true,
		});
		setSavingPassword(false);
		if (error) {
			toast("Failed to change password", "error");
			return;
		}
		toast("Password changed", "success");
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
	};

	const handleDeleteAccount = async () => {
		if (deleteConfirm !== profile.username && deleteConfirm !== profile.email) {
			toast("Please type your username or email to confirm", "error");
			return;
		}
		const { error } = await authClient.deleteUser({
			callbackURL: "/",
		});
		if (error) toast("Failed to delete account", "error");
	};

	// Kick off background enrichment for all bookmarks that are still missing
	// metadata (title still a URL, no description, no image, no favicon).
	const handleEnrichAll = async () => {
		setEnriching(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/bookmarks/enrich-all`,
				{ method: "POST", credentials: "include" },
			);
			if (!res.ok) {
				toast("Failed to start enrichment", "error");
				return;
			}
			const { queued } = await res.json();
			if (queued === 0) {
				toast("All bookmarks are already enriched", "success");
			} else {
				toast(
					`Enriching ${queued} bookmark${queued === 1 ? "" : "s"} in the background`,
					"success",
				);
				// Signal BookmarkList to start polling so enriched metadata
				// appears without a manual page refresh.
				window.dispatchEvent(new CustomEvent("kura:enrich-started"));
			}
		} catch {
			toast("Failed to start enrichment", "error");
		} finally {
			setEnriching(false);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="font-semibold text-base text-foreground">Account</h2>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Manage your email, password, and account.
				</p>
			</div>

			{/* Email */}
			<div className="flex flex-col gap-3 rounded-xl border border-border p-4">
				<p className="font-medium text-foreground text-sm">Email address</p>
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				<button
					type="button"
					onClick={handleChangeEmail}
					disabled={savingEmail || email === profile.email}
					className="ml-auto h-8 cursor-pointer rounded-lg bg-primary px-3 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{savingEmail ? "Sending…" : "Update email"}
				</button>
			</div>

			{/* Password */}
			<div className="flex flex-col gap-3 rounded-xl border border-border p-4">
				<p className="font-medium text-foreground text-sm">Change password</p>
				<input
					type="password"
					placeholder="Current password"
					value={currentPassword}
					onChange={(e) => setCurrentPassword(e.target.value)}
					className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				<input
					type="password"
					placeholder="New password"
					value={newPassword}
					onChange={(e) => setNewPassword(e.target.value)}
					className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				<input
					type="password"
					placeholder="Confirm new password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				<button
					type="button"
					onClick={handleChangePassword}
					disabled={savingPassword || !currentPassword || !newPassword}
					className="ml-auto h-8 cursor-pointer rounded-lg bg-primary px-3 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{savingPassword ? "Saving…" : "Change password"}
				</button>
			</div>

			{/* Bookmarks data */}
			<div className="flex flex-col gap-3 rounded-xl border border-border p-4">
				<div>
					<p className="font-medium text-foreground text-sm">
						Bookmark metadata
					</p>
					<p className="mt-0.5 text-muted-foreground text-xs">
						Re-fetch titles, descriptions, images, and favicons for bookmarks
						that are missing them. Runs in the background without blocking the
						app.
					</p>
				</div>
				<button
					type="button"
					onClick={handleEnrichAll}
					disabled={enriching}
					className="ml-auto h-8 cursor-pointer rounded-lg bg-primary px-3 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{enriching ? "Starting…" : "Re-enrich bookmarks"}
				</button>
			</div>

			{/* Sign out */}
			<button
				type="button"
				onClick={() =>
					authClient.signOut().then(() => {
						window.location.href = "/login";
					})
				}
				className="flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border border-border font-medium text-sm transition-colors hover:bg-muted"
			>
				Sign out
			</button>

			{/* Danger zone */}
			<div className="flex flex-col gap-3 rounded-xl border border-destructive/30 p-4">
				<button
					type="button"
					onClick={() => setShowDanger((v) => !v)}
					className="flex w-full cursor-pointer items-center justify-between font-medium text-destructive text-sm"
				>
					Danger zone
					{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative chevron, aria-hidden */}
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						className={cn("transition-transform", showDanger && "rotate-180")}
						aria-hidden
					>
						<path
							d="M2 4l4 4 4-4"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
				<AnimatePresence>
					{showDanger && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="flex flex-col gap-3 overflow-hidden"
						>
							<p className="text-muted-foreground text-xs">
								This will permanently delete your account, all bookmarks, and
								all data. This cannot be undone.
							</p>
							<input
								type="text"
								placeholder={`Type "${profile.username || profile.email}" to confirm`}
								value={deleteConfirm}
								onChange={(e) => setDeleteConfirm(e.target.value)}
								className="h-9 w-full rounded-lg border border-destructive/40 bg-muted/40 px-3 text-sm transition-colors focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20"
							/>
							<button
								type="button"
								onClick={handleDeleteAccount}
								disabled={deleteConfirm !== (profile.username ?? profile.email)}
								className="h-9 w-full cursor-pointer rounded-lg bg-destructive font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
							>
								Delete my account
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-baseline justify-between gap-2">
				<span className="font-medium text-muted-foreground text-xs">
					{label}
				</span>
				{hint && (
					<span className="text-[11px] text-muted-foreground/60">{hint}</span>
				)}
			</div>
			{children}
		</div>
	);
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: { onClose: () => void }) {
	const [section, setSection] = useState<Section>("profile");
	const [profile, setProfile] = useState<UserProfile | null>(null);
	// tracks whether ProfileSection has staged unsaved changes
	const [isDirty, setIsDirty] = useState(false);
	// shown when user attempts to close with unsaved changes
	const [unsavedWarning, setUnsavedWarning] = useState(false);
	// ref for the modal sheet so we can shake it imperatively
	const [sheetScope, animateSheet] = useAnimate();

	useEffect(() => {
		fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me`, {
			credentials: "include",
		})
			.then((r) => r.json())
			.then(setProfile);
	}, []);

	// intercept close: if profile section is dirty, shake the modal and show the Cancel button
	const handleClose = useCallback(() => {
		if (isDirty && section === "profile") {
			setUnsavedWarning(true);
			// shake the sheet to signal there are unsaved changes
			animateSheet(
				sheetScope.current,
				{ x: [0, -10, 10, -7, 7, -4, 4, 0] },
				{ duration: 0.45, ease: "easeInOut" },
			);
			// haptic feedback pattern — graceful fallback if vibration API is unavailable
			if (typeof navigator !== "undefined" && "vibrate" in navigator) {
				// convert intensity-based pattern to the [duration, gap, ...] format
				// the gaps are taken from each item's `delay` field
				navigator.vibrate([40, 40, 40, 40, 40, 40, 50]);
			}
		} else {
			onClose();
		}
	}, [isDirty, section, onClose, animateSheet, sheetScope]);

	// close on Escape — respects dirty guard
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [handleClose]);

	// dismiss warning when user interacts with a different section
	const handleSectionChange = (s: Section) => {
		setUnsavedWarning(false);
		setSection(s);
	};

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
			{/* backdrop */}
			<motion.div
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={handleClose}
			/>

			{/* sheet */}
			<motion.div
				ref={sheetScope}
				className="relative z-10 flex h-full max-h-[680px] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
				initial={{ opacity: 0, scale: 0.97, y: 12 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.97, y: 12 }}
				transition={{ type: "spring", stiffness: 380, damping: 30 }}
			>
				{/* sidebar */}
				<div className="flex w-44 shrink-0 flex-col gap-1 border-border border-r p-3 pt-4">
					<p className="mb-2 px-3 font-semibold text-muted-foreground/60 text-xs uppercase tracking-wider">
						Settings
					</p>
					<NavItem
						label="Profile"
						active={section === "profile"}
						onClick={() => handleSectionChange("profile")}
					/>
					<NavItem
						label="Appearance"
						active={section === "appearance"}
						onClick={() => handleSectionChange("appearance")}
					/>
					<NavItem
						label="Friends"
						active={section === "friends"}
						onClick={() => handleSectionChange("friends")}
					/>
					<NavItem
						label="Badges"
						active={section === "badges"}
						onClick={() => handleSectionChange("badges")}
					/>
					<NavItem
						label="Account"
						active={section === "account"}
						onClick={() => handleSectionChange("account")}
					/>
					<div className="mt-auto">
						<button
							type="button"
							onClick={handleClose}
							className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-muted-foreground text-sm transition-colors hover:bg-muted"
						>
							Close
						</button>
					</div>
				</div>

				{/* content */}
				<div className="min-h-0 flex-1 overflow-y-auto p-6">
					<AnimatePresence mode="wait">
						{section === "profile" && (
							<motion.div
								key="profile"
								initial={{ opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ duration: 0.15 }}
							>
								{profile ? (
									<ProfileSection
										profile={profile}
										onDirtyChange={setIsDirty}
										unsavedWarning={unsavedWarning}
										onDiscardAndClose={() => {
											setIsDirty(false);
											setUnsavedWarning(false);
											onClose();
										}}
										// when the profile saves successfully, update the local
										// profile state so future dirty checks compare against
										// the freshly-saved values instead of the original ones
										onProfileSaved={(next) => {
											setProfile((prev) =>
												prev ? { ...prev, ...next } : prev,
											);
											setIsDirty(false);
											setUnsavedWarning(false);
										}}
									/>
								) : (
									<div className="flex flex-col gap-4">
										{[...Array(4)].map((_, i) => (
											<div
												key={i}
												className="h-10 animate-pulse rounded-lg bg-muted"
											/>
										))}
									</div>
								)}
							</motion.div>
						)}
						{section === "appearance" && (
							<motion.div
								key="appearance"
								initial={{ opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ duration: 0.15 }}
							>
								<AppearanceSection />
							</motion.div>
						)}
						{section === "friends" && (
							<motion.div
								key="friends"
								initial={{ opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ duration: 0.15 }}
							>
								<FriendsSection />
							</motion.div>
						)}
						{section === "badges" && (
							<motion.div
								key="badges"
								initial={{ opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ duration: 0.15 }}
							>
								<BadgesSection />
							</motion.div>
						)}
						{section === "account" && (
							<motion.div
								key="account"
								initial={{ opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ duration: 0.15 }}
							>
								{profile ? (
									<AccountSection profile={profile} />
								) : (
									<div className="flex flex-col gap-4">
										{[...Array(3)].map((_, i) => (
											<div
												key={i}
												className="h-10 animate-pulse rounded-lg bg-muted"
											/>
										))}
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</motion.div>
		</div>
	);
}
