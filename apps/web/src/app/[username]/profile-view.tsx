"use client";

import { useToast } from "@Kura/ui/components/toast";
import { cn } from "@Kura/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { IconArrowLeft } from "nucleo-micro-bold";
import { useEffect, useState } from "react";
import {
	AchievementBadgeChip,
	type AchievementBadgeData,
} from "@/components/achievement-badge";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
	id: string;
	name: string;
	username: string;
	bio: string | null;
	image: string | null;
	banner: string | null;
	createdAt: string;
	followerCount: number;
	followingCount: number;
	isFollowing: boolean;
}

interface PublicBookmark {
	id: string;
	url: string;
	title: string | null;
	description: string | null;
	image: string | null;
	favicon: string | null;
	siteName: string | null;
	createdAt: string;
	collection: { id: string; name: string; color: string | null } | null;
}

interface PublicCollection {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	createdAt: string;
	bookmarkCount: number;
	followerCount: number;
	isFollowing: boolean;
}

interface PublicBadge extends AchievementBadgeData {
	unlockedAt: string;
}

type Tab = "bookmarks" | "collections";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomain(url: string) {
	try {
		return new URL(url).hostname.replace("www.", "");
	} catch {
		return url;
	}
}

function getFaviconUrl(url: string) {
	try {
		return `https://www.google.com/s2/favicons?domain=${new URL(url).origin}&sz=32`;
	} catch {
		return null;
	}
}

function formatJoinDate(date: string) {
	return new Date(date).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
}

// ─── Save bookmark dialog ─────────────────────────────────────────────────────

function SaveBookmarkDialog({
	bookmark,
	onClose,
}: {
	bookmark: PublicBookmark;
	onClose: () => void;
}) {
	const { toast } = useToast();
	const [collections, setCollections] = useState<
		{ id: string; name: string }[]
	>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		api.collections.get().then(({ data }) => {
			if (data && Array.isArray(data))
				setCollections(data.map((c) => ({ id: c.id, name: c.name })));
		});
	}, []);

	const handleSave = async () => {
		setSaving(true);
		const { error } = await api.bookmarks.post({
			url: bookmark.url,
			collectionId: selectedId,
		});
		setSaving(false);
		if (error) {
			toast("Failed to save bookmark", "error");
			return;
		}
		toast("Bookmark saved", "success");
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
			<motion.div
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
			/>
			<motion.div
				className="relative z-10 mx-4 w-full max-w-sm rounded-2xl border border-border bg-popover p-5 shadow-xl"
				initial={{ opacity: 0, y: 16, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: 16, scale: 0.97 }}
				transition={{ type: "spring", stiffness: 380, damping: 28 }}
			>
				<p className="mb-1 font-semibold text-foreground text-sm">
					Save bookmark
				</p>
				<p className="mb-4 truncate text-muted-foreground text-xs">
					{bookmark.title || getDomain(bookmark.url)}
				</p>

				<div className="mb-4 flex flex-col gap-1">
					<button
						type="button"
						onClick={() => setSelectedId(null)}
						className={cn(
							"flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
							selectedId === null
								? "bg-primary/10 text-primary"
								: "text-foreground hover:bg-muted",
						)}
					>
						<span className="size-2 shrink-0 rounded-full border border-border" />
						No collection
					</button>
					{collections.map((c) => (
						<button
							key={c.id}
							type="button"
							onClick={() => setSelectedId(c.id)}
							className={cn(
								"flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
								selectedId === c.id
									? "bg-primary/10 text-primary"
									: "text-foreground hover:bg-muted",
							)}
						>
							<span className="size-2 shrink-0 rounded-full bg-primary/60" />
							{c.name}
						</button>
					))}
				</div>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 rounded-lg border border-border px-3 py-2 font-medium text-xs transition-colors hover:bg-muted"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="flex-1 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Saving…" : "Save"}
					</button>
				</div>
			</motion.div>
		</div>
	);
}

// ─── Bookmark card ────────────────────────────────────────────────────────────

function BookmarkCard({
	bookmark,
	onSave,
}: {
	bookmark: PublicBookmark;
	onSave: () => void;
}) {
	const domain = getDomain(bookmark.url);
	const faviconUrl = getFaviconUrl(bookmark.url);

	return (
		<div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50">
			<span className="flex size-5 shrink-0 items-center justify-center">
				{faviconUrl ? (
					<Image
						src={faviconUrl}
						alt=""
						width={20}
						height={20}
						className="size-5 rounded-sm"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = "none";
						}}
					/>
				) : (
					<span className="block size-5 rounded-sm bg-muted" />
				)}
			</span>

			<div className="flex min-w-0 flex-1 items-baseline gap-2">
				<a
					href={bookmark.url}
					target="_blank"
					rel="noopener noreferrer"
					className="truncate font-medium text-foreground text-sm hover:underline"
				>
					{bookmark.title || domain}
				</a>
				<span className="shrink-0 text-muted-foreground text-xs">{domain}</span>
			</div>

			<button
				type="button"
				onClick={onSave}
				className="shrink-0 rounded-full border border-border px-2.5 py-1 font-medium text-xs opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
			>
				Save
			</button>
		</div>
	);
}

// ─── Collection bookmark item (used inside expanded CollectionCard) ───────────

interface CollectionBookmarkItem {
	id: string;
	url: string;
	title: string | null;
	favicon: string | null;
	siteName: string | null;
}

// ─── Collection card ──────────────────────────────────────────────────────────

function CollectionCard({
	collection,
	onToggleFollow,
}: {
	collection: PublicCollection;
	onToggleFollow: () => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [bookmarks, setBookmarks] = useState<CollectionBookmarkItem[]>([]);
	const [loadingBookmarks, setLoadingBookmarks] = useState(false);
	const [hasFetched, setHasFetched] = useState(false);

	// Lazy-fetch bookmarks the first time the card is expanded.
	const handleToggle = async () => {
		const next = !isOpen;
		setIsOpen(next);

		if (next && !hasFetched) {
			setLoadingBookmarks(true);
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/collections/${collection.id}/public-bookmarks`,
					{ credentials: "include" },
				);
				if (res.ok) {
					const data = await res.json();
					setBookmarks(Array.isArray(data) ? data : []);
				}
			} finally {
				setLoadingBookmarks(false);
				setHasFetched(true);
			}
		}
	};

	const accentColor = collection.color ?? "hsl(var(--primary))";

	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-border/50 bg-card transition-colors",
				isOpen && "border-border/80",
			)}
		>
			{/* ── Header row ── */}
			<div className="flex items-center gap-0">
				{/* Color accent stripe — clicking it also toggles */}
				<button
					type="button"
					aria-label="Toggle collection"
					onClick={handleToggle}
					className="flex h-full w-1.5 shrink-0 self-stretch focus:outline-none"
					style={{ backgroundColor: accentColor }}
				/>

				{/* Main clickable area */}
				<button
					type="button"
					onClick={handleToggle}
					className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left focus:outline-none"
				>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="truncate font-semibold text-foreground text-sm">
							{collection.name}
						</p>
						{collection.description && (
							<p className="truncate text-muted-foreground text-xs">
								{collection.description}
							</p>
						)}
						<p className="text-muted-foreground text-xs">
							{collection.bookmarkCount} public bookmark
							{collection.bookmarkCount !== 1 ? "s" : ""}
							{collection.followerCount > 0 &&
								` · ${collection.followerCount} follower${collection.followerCount !== 1 ? "s" : ""}`}
						</p>
					</div>

					{/* Chevron */}
					<motion.svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						className="size-4 shrink-0 text-muted-foreground"
						animate={{ rotate: isOpen ? 180 : 0 }}
						transition={{ type: "spring", stiffness: 320, damping: 28 }}
					>
						<path
							fillRule="evenodd"
							d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
							clipRule="evenodd"
						/>
					</motion.svg>
				</button>

				{/* Follow button — outside the toggle area so it doesn't collapse */}
				<div className="shrink-0 pr-4">
					<button
						type="button"
						onClick={onToggleFollow}
						className={cn(
							"rounded-full px-3 py-1.5 font-medium text-xs transition-colors",
							collection.isFollowing
								? "bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
								: "border border-border hover:bg-muted",
						)}
					>
						{collection.isFollowing ? "Following" : "Follow"}
					</button>
				</div>
			</div>

			{/* ── Expandable bookmark list ── */}
			<AnimatePresence initial={false}>
				{isOpen && (
					<motion.div
						key="bookmarks"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className="overflow-hidden"
					>
						<div className="border-border/50 border-t pb-1">
							{loadingBookmarks ? (
								// Skeleton rows
								<div className="flex flex-col gap-0.5 px-4 py-2">
									{[0.9, 0.7, 0.8].map((o, i) => (
										<div key={i} className="flex items-center gap-3 py-2">
											<span
												className="size-4 shrink-0 animate-pulse rounded-sm bg-muted"
												style={{ opacity: o }}
											/>
											<span
												className="h-3.5 flex-1 animate-pulse rounded bg-muted"
												style={{ opacity: o }}
											/>
										</div>
									))}
								</div>
							) : bookmarks.length === 0 ? (
								<p className="px-4 py-4 text-center text-muted-foreground text-xs">
									No bookmarks yet.
								</p>
							) : (
								<ul className="flex flex-col">
									{bookmarks.map((bm) => {
										const domain = getDomain(bm.url);
										const favicon = bm.favicon ?? getFaviconUrl(bm.url);
										return (
											<li key={bm.id}>
												<a
													href={bm.url}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
												>
													<span className="flex size-4 shrink-0 items-center justify-center">
														{favicon ? (
															<Image
																src={favicon}
																alt=""
																width={16}
																height={16}
																className="size-4 rounded-sm"
																onError={(e) => {
																	(e.target as HTMLImageElement).style.display =
																		"none";
																}}
															/>
														) : (
															<span className="block size-4 rounded-sm bg-muted" />
														)}
													</span>
													<span className="min-w-0 flex-1 truncate text-foreground text-sm">
														{bm.title || domain}
													</span>
													<span className="shrink-0 text-muted-foreground text-xs">
														{domain}
													</span>
												</a>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProfileView({
	profile: initialProfile,
	isOwnProfile,
}: {
	profile: Profile;
	isOwnProfile: boolean;
}) {
	const { toast } = useToast();
	const [profile, setProfile] = useState(initialProfile);
	const [tab, setTab] = useState<Tab>("bookmarks");
	const [bookmarks, setBookmarks] = useState<PublicBookmark[]>([]);
	const [collections, setCollections] = useState<PublicCollection[]>([]);
	const [badges, setBadges] = useState<PublicBadge[]>([]);
	const [loading, setLoading] = useState(true);
	const [saveBookmark, setSaveBookmark] = useState<PublicBookmark | null>(null);

	// fetch tab content and keep it fresh while viewing the profile
	useEffect(() => {
		let cancelled = false;

		const loadTabContent = async (options: { showSpinner: boolean }) => {
			// Only show the skeleton on the first/manual load, not on background polling.
			if (options.showSpinner) {
				setLoading(true);
			}

			try {
				const endpoint =
					tab === "bookmarks"
						? `/users/${profile.username}/bookmarks`
						: `/users/${profile.username}/collections`;

				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}${endpoint}`,
					{ credentials: "include" },
				);
				if (!res.ok) return;

				const data = await res.json();

				if (cancelled) return;

				if (tab === "bookmarks") {
					setBookmarks(Array.isArray(data) ? data : []);
				} else {
					setCollections(Array.isArray(data) ? data : []);
				}
			} finally {
				if (!cancelled && options.showSpinner) {
					setLoading(false);
				}
			}
		};

		// initial load for this tab change – only show skeleton if we don't already
		// have data for the active tab
		const hasDataAlready =
			tab === "bookmarks" ? bookmarks.length > 0 : collections.length > 0;

		void loadTabContent({ showSpinner: !hasDataAlready });

		// lightweight polling so changes to bookmarks / collections show up in near‑realtime
		// keep existing content visible while refreshing in the background
		const intervalId = window.setInterval(
			() => void loadTabContent({ showSpinner: false }),
			5000,
		);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, [tab, profile.username, bookmarks.length, collections.length]);

	// keep profile header (avatar, banner, counts) in sync if it changes
	useEffect(() => {
		let cancelled = false;

		const loadProfile = async () => {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${profile.username}`,
					{ credentials: "include" },
				);
				if (!res.ok) return;

				const fresh = (await res.json()) as Profile;
				if (cancelled) return;

				setProfile((prev) =>
					prev.id === fresh.id ? { ...prev, ...fresh } : prev,
				);
			} catch {
				// ignore network errors here; page still works with last known data
			}
		};

		// initial refresh
		void loadProfile();

		// gentle polling for avatar / banner / counts
		const intervalId = window.setInterval(loadProfile, 10000);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, [profile.username]);

	// Load public badges independently so the profile header can render them
	// without coupling badge visibility to the bookmarks/collections tab state.
	useEffect(() => {
		let cancelled = false;

		const loadBadges = async () => {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${profile.username}/badges`,
					{ credentials: "include" },
				);
				if (!res.ok) return;

				const data = (await res.json()) as PublicBadge[];
				if (!cancelled) {
					setBadges(Array.isArray(data) ? data : []);
				}
			} catch {
				// Keep badges non-blocking; the profile still renders without them.
			}
		};

		void loadBadges();

		return () => {
			cancelled = true;
		};
	}, [profile.username]);

	const handleToggleFollow = async () => {
		const wasFollowing = profile.isFollowing;
		setProfile((p) => ({
			...p,
			isFollowing: !wasFollowing,
			followerCount: wasFollowing ? p.followerCount - 1 : p.followerCount + 1,
		}));

		const method = wasFollowing ? "DELETE" : "POST";
		const res = await fetch(
			`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${profile.username}/follow`,
			{ method, credentials: "include" },
		);
		if (!res.ok) {
			setProfile((p) => ({
				...p,
				isFollowing: wasFollowing,
				followerCount: wasFollowing ? p.followerCount + 1 : p.followerCount - 1,
			}));
			toast("Failed to update follow", "error");
			return;
		}

		// Follower milestones can unlock from this action, so ask the global
		// badge watcher to refresh as soon as the follow change succeeds.
		window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
	};

	const handleToggleCollectionFollow = async (
		collectionId: string,
		wasFollowing: boolean,
	) => {
		setCollections((prev) =>
			prev.map((c) =>
				c.id === collectionId
					? {
							...c,
							isFollowing: !wasFollowing,
							followerCount: wasFollowing
								? c.followerCount - 1
								: c.followerCount + 1,
						}
					: c,
			),
		);

		const method = wasFollowing ? "DELETE" : "POST";
		const res = await fetch(
			`${process.env.NEXT_PUBLIC_SERVER_URL}/users/collections/${collectionId}/follow`,
			{ method, credentials: "include" },
		);
		if (!res.ok) {
			setCollections((prev) =>
				prev.map((c) =>
					c.id === collectionId
						? {
								...c,
								isFollowing: wasFollowing,
								followerCount: wasFollowing
									? c.followerCount + 1
									: c.followerCount - 1,
							}
						: c,
				),
			);
			toast("Failed to update follow", "error");
		} else {
			toast(
				wasFollowing
					? "Collection unfollowed"
					: "Collection saved to dashboard",
				"success",
			);
			// Collection-follow achievements are unlocked from this action, so
			// re-check badges immediately after a successful response.
			window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-12">
				{/* ── Back to app ── */}
				<Link
					href="/dashboard"
					className="mb-6 -ml-1 flex w-fit cursor-pointer items-center gap-2 rounded-full py-1.5 pr-2.5 pl-1 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					aria-label="Back to dashboard"
				>
					<IconArrowLeft size={16} aria-hidden />
					<span>Back to dashboard</span>
				</Link>

				{/* ── Banner ── */}
				<div className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-muted/40">
					{profile.banner ? (
						<div className="relative h-40 w-full sm:h-48">
							<Image
								src={profile.banner}
								alt=""
								fill
								className="object-cover"
								priority
							/>
						</div>
					) : (
						<div className="h-40 w-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.04),_transparent_55%)] sm:h-48" />
					)}
				</div>

				{/* ── Profile header ── */}
				<div className="mb-10 flex flex-col gap-6">
					<div className="flex items-start justify-between gap-4">
						{/* avatar */}
						<div className="flex items-center gap-4">
							{profile.image ? (
								<Image
									src={profile.image}
									alt={profile.name}
									width={64}
									height={64}
									className="size-16 rounded-full object-cover ring-2 ring-border"
								/>
							) : (
								<div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-2xl text-primary">
									{profile.name.charAt(0).toUpperCase()}
								</div>
							)}
							<div>
								<h1 className="font-bold text-2xl text-foreground tracking-tight">
									{profile.name}
								</h1>
								<p className="text-muted-foreground text-sm">
									@{profile.username}
								</p>
							</div>
						</div>

						{/* follow button */}
						{!isOwnProfile && (
							<button
								type="button"
								onClick={handleToggleFollow}
								className={cn(
									"shrink-0 rounded-full px-4 py-2 font-medium text-sm transition-colors",
									profile.isFollowing
										? "bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
										: "bg-primary text-primary-foreground hover:opacity-90",
								)}
							>
								{profile.isFollowing ? "Following" : "Follow"}
							</button>
						)}
					</div>

					{/* bio */}
					{profile.bio && (
						<p className="max-w-md text-foreground/80 text-sm leading-relaxed">
							{profile.bio}
						</p>
					)}

					{/* stats */}
					<div className="flex items-center gap-5 text-sm">
						<div className="flex items-center gap-1.5">
							<span className="font-semibold text-foreground">
								{profile.followerCount}
							</span>
							<span className="text-muted-foreground">followers</span>
						</div>
						<div className="flex items-center gap-1.5">
							<span className="font-semibold text-foreground">
								{profile.followingCount}
							</span>
							<span className="text-muted-foreground">following</span>
						</div>
						<span className="ml-auto text-muted-foreground text-xs">
							Joined {formatJoinDate(profile.createdAt)}
						</span>
					</div>

					{badges.length > 0 && (
						<motion.div
							className="flex flex-wrap gap-1.5"
							initial="hidden"
							animate="visible"
							variants={{
								hidden: {},
								visible: { transition: { staggerChildren: 0.05 } },
							}}
						>
							{badges.map((badge) => (
								<motion.div
									key={badge.id}
									variants={{
										hidden: { opacity: 0, scale: 0.92 },
										visible: {
											opacity: 1,
											scale: 1,
											transition: {
												type: "spring" as const,
												stiffness: 400,
												damping: 25,
											},
										},
									}}
								>
									<AchievementBadgeChip badge={badge} variant="icon-only" />
								</motion.div>
							))}
						</motion.div>
					)}
				</div>

				{/* ── Tabs ── */}
				<div className="mb-6 flex w-fit items-center gap-1 rounded-full bg-muted p-1">
					{(["bookmarks", "collections"] as Tab[]).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={cn(
								"rounded-full px-3.5 py-1.5 font-medium text-sm capitalize transition-colors",
								tab === t
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{t}
						</button>
					))}
				</div>

				{/* ── Content ── */}
				{loading ? (
					<div className="flex flex-col gap-1 pt-2">
						{[0.9, 0.75, 0.85, 0.6, 0.7].map((opacity, i) => (
							<div key={i} className="flex items-center gap-3 px-3 py-2.5">
								<span
									className="size-5 shrink-0 animate-pulse rounded-sm bg-muted"
									style={{ opacity }}
								/>
								<span
									className="h-4 flex-1 animate-pulse rounded bg-muted"
									style={{ opacity }}
								/>
							</div>
						))}
					</div>
				) : tab === "bookmarks" ? (
					<AnimatePresence mode="wait">
						<motion.div
							key="bookmarks"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="flex flex-col"
						>
							{bookmarks.length === 0 ? (
								<p className="py-16 text-center text-muted-foreground text-sm">
									No public bookmarks yet.
								</p>
							) : (
								bookmarks.map((b) => (
									<BookmarkCard
										key={b.id}
										bookmark={b}
										onSave={() => setSaveBookmark(b)}
									/>
								))
							)}
						</motion.div>
					</AnimatePresence>
				) : (
					<AnimatePresence mode="wait">
						<motion.div
							key="collections"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="flex flex-col gap-2"
						>
							{collections.length === 0 ? (
								<p className="py-16 text-center text-muted-foreground text-sm">
									No public collections yet.
								</p>
							) : (
								collections.map((c) => (
									<CollectionCard
										key={c.id}
										collection={c}
										onToggleFollow={() =>
											handleToggleCollectionFollow(c.id, c.isFollowing)
										}
									/>
								))
							)}
						</motion.div>
					</AnimatePresence>
				)}
			</div>

			{/* ── Save bookmark dialog ── */}
			<AnimatePresence>
				{saveBookmark && (
					<SaveBookmarkDialog
						bookmark={saveBookmark}
						onClose={() => setSaveBookmark(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
