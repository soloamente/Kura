"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@Kura/ui/components/dropdown-menu";
import { useToast } from "@Kura/ui/components/toast";
import { cn } from "@Kura/ui/lib/utils";
import { motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { TextMorph } from "torph/react";
import { api } from "@/lib/api";
import {
	contextMenuItemCls,
	contextMenuPopupCls,
} from "@/lib/context-menu-styles";
import { getPublicProfileUrl } from "@/lib/public-profile-url";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getFaviconUrl(url: string) {
	try {
		const { origin } = new URL(url);
		return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
	} catch {
		return null;
	}
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExplorePerson {
	id: string;
	name: string;
	username: string | null;
	image: string | null;
	followerCount: number;
	isFollowing: boolean;
}

interface ExploreCollection {
	id: string;
	name: string;
	color: string | null;
	owner: {
		id: string;
		name: string;
		username: string | null;
		image: string | null;
	} | null;
	followerCount: number;
	bookmarkCount: number;
	isFollowing: boolean;
}

interface ExploreBookmarkItem {
	domain: string;
	saveCount: number;
	exampleUrl: string;
}

type ExploreSegment = "people" | "collections" | "bookmarks";

// ─── Explore view (people + collections by follower count) ──────────────────────

export function ExploreView({
	segment,
	onSegmentChange,
}: {
	segment: ExploreSegment;
	onSegmentChange: (s: ExploreSegment) => void;
}) {
	const { toast, update, dismiss } = useToast();
	const [people, setPeople] = useState<ExplorePerson[]>([]);
	const [collections, setCollections] = useState<ExploreCollection[]>([]);
	const [bookmarks, setBookmarks] = useState<ExploreBookmarkItem[]>([]);
	const [loadingPeople, setLoadingPeople] = useState(true);
	const [loadingCollections, setLoadingCollections] = useState(true);
	const [loadingBookmarks, setLoadingBookmarks] = useState(true);
	// Collections for "Save to…" dropdown on bookmark rows (loaded when bookmarks segment is shown)
	const [saveCollections, setSaveCollections] = useState<
		{ id: string; name: string }[]
	>([]);

	const loadPeople = useCallback(async () => {
		setLoadingPeople(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/explore/people`,
				{ credentials: "include" },
			);
			if (!res.ok) throw new Error("Failed to load");
			const data = await res.json();
			setPeople(Array.isArray(data) ? data : []);
		} catch {
			toast("Failed to load people", "error");
			setPeople([]);
		} finally {
			setLoadingPeople(false);
		}
	}, [toast]);

	const loadCollections = useCallback(async () => {
		setLoadingCollections(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/explore/collections`,
				{ credentials: "include" },
			);
			if (!res.ok) throw new Error("Failed to load");
			const data = await res.json();
			setCollections(Array.isArray(data) ? data : []);
		} catch {
			toast("Failed to load collections", "error");
			setCollections([]);
		} finally {
			setLoadingCollections(false);
		}
	}, [toast]);

	const loadBookmarks = useCallback(async () => {
		setLoadingBookmarks(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/explore/trending`,
				{ credentials: "include" },
			);
			if (!res.ok) throw new Error("Failed to load");
			const data = await res.json();
			setBookmarks(Array.isArray(data) ? data : []);
		} catch {
			toast("Failed to load trending sites", "error");
			setBookmarks([]);
		} finally {
			setLoadingBookmarks(false);
		}
	}, [toast]);

	useEffect(() => {
		void loadPeople();
	}, [loadPeople]);

	useEffect(() => {
		void loadCollections();
	}, [loadCollections]);

	useEffect(() => {
		void loadBookmarks();
	}, [loadBookmarks]);

	// Load collections for Save dropdown when user is on Trending segment
	useEffect(() => {
		if (segment !== "bookmarks") return;
		api.collections.get().then(({ data }) => {
			if (data && Array.isArray(data))
				setSaveCollections(data.map((c) => ({ id: c.id, name: c.name })));
		});
	}, [segment]);

	// Save bookmark from trending row; on 409 (already saved) show "Save anyway" option
	const handleSaveBookmark = useCallback(
		async (url: string, collectionId: string | null) => {
			const id = toast("Saving bookmark…", "loading");
			const { error, status } = await api.bookmarks.post({ url, collectionId });

			if (status === 409) {
				update(id, "Already saved", "warn", [
					{
						label: "Don't save",
						variant: "secondary",
						onClick: () => dismiss(id),
					},
					{
						label: "Save anyway",
						variant: "primary",
						onClick: async () => {
							dismiss(id);
							const loadingId = toast("Saving bookmark…", "loading");
							const { error: forceError } = await api.bookmarks.force.post({
								url,
								collectionId,
							});
							if (forceError)
								update(loadingId, "Failed to save bookmark", "error");
							else {
								update(loadingId, "Bookmark saved", "success");
								window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
								window.dispatchEvent(new CustomEvent("kura:enrich-started"));
							}
						},
					},
				]);
				return;
			}

			if (error) {
				update(id, "Failed to save bookmark", "error");
				return;
			}
			update(id, "Bookmark saved", "success");
			window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
			window.dispatchEvent(new CustomEvent("kura:enrich-started"));
		},
		[toast, update, dismiss],
	);

	const handleFollowUser = useCallback(
		async (username: string | null) => {
			if (!username) return;
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${encodeURIComponent(username)}/follow`,
					{ method: "POST", credentials: "include" },
				);
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					toast(
						(body as { message?: string }).message ?? "Failed to follow",
						"error",
					);
					return;
				}
				setPeople((prev) =>
					prev.map((p) =>
						p.username === username ? { ...p, isFollowing: true } : p,
					),
				);
			} catch {
				toast("Failed to follow", "error");
			}
		},
		[toast],
	);

	const handleUnfollowUser = useCallback(
		async (username: string | null) => {
			if (!username) return;
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${encodeURIComponent(username)}/follow`,
					{ method: "DELETE", credentials: "include" },
				);
				if (!res.ok) {
					toast("Failed to unfollow", "error");
					return;
				}
				setPeople((prev) =>
					prev.map((p) =>
						p.username === username ? { ...p, isFollowing: false } : p,
					),
				);
			} catch {
				toast("Failed to unfollow", "error");
			}
		},
		[toast],
	);

	const handleFollowCollection = useCallback(
		async (collectionId: string) => {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/collections/${collectionId}/follow`,
					{ method: "POST", credentials: "include" },
				);
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					toast(
						(body as { message?: string }).message ?? "Failed to follow",
						"error",
					);
					return;
				}
				setCollections((prev) =>
					prev.map((c) =>
						c.id === collectionId ? { ...c, isFollowing: true } : c,
					),
				);
				window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
			} catch {
				toast("Failed to follow", "error");
			}
		},
		[toast],
	);

	const handleUnfollowCollection = useCallback(
		async (collectionId: string) => {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/collections/${collectionId}/follow`,
					{ method: "DELETE", credentials: "include" },
				);
				if (!res.ok) {
					toast("Failed to unfollow", "error");
					return;
				}
				setCollections((prev) =>
					prev.map((c) =>
						c.id === collectionId ? { ...c, isFollowing: false } : c,
					),
				);
				window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
			} catch {
				toast("Failed to unfollow", "error");
			}
		},
		[toast],
	);

	return (
		<main className="flex min-h-0 flex-1 flex-col">
			{/* Segment tabs: People | Collections | Trending */}
			<div className="flex shrink-0 items-center justify-center gap-1 pt-2 pb-4">
				<button
					type="button"
					onClick={() => onSegmentChange("people")}
					className={cn(
						"cursor-pointer rounded-full px-3 py-1.5 font-medium text-sm outline-none transition-colors",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						segment === "people"
							? "bg-foreground text-background"
							: "text-foreground hover:opacity-80",
					)}
				>
					People
				</button>
				<button
					type="button"
					onClick={() => onSegmentChange("collections")}
					className={cn(
						"cursor-pointer rounded-full px-3 py-1.5 font-medium text-sm outline-none transition-colors",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						segment === "collections"
							? "bg-foreground text-background"
							: "text-foreground hover:opacity-80",
					)}
				>
					Collections
				</button>
				<button
					type="button"
					onClick={() => onSegmentChange("bookmarks")}
					className={cn(
						"cursor-pointer rounded-full px-3 py-1.5 font-medium text-sm outline-none transition-colors",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						segment === "bookmarks"
							? "bg-foreground text-background"
							: "text-foreground hover:opacity-80",
					)}
				>
					Bookmarks
				</button>
			</div>

			<div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
				<div className="w-full max-w-2xl px-4 pb-8">
					{segment === "people" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.15 }}
							className="flex flex-col"
						>
							{loadingPeople ? (
								<div className="flex flex-col py-4">
									{[1, 2, 3, 4, 5].map((i) => (
										<div
											key={i}
											className="flex items-center gap-3 rounded-full px-4 py-3"
										>
											<div className="size-12 shrink-0 animate-pulse rounded-full bg-muted" />
											<div className="min-w-0 flex-1 space-y-1">
												<div className="h-4 w-32 animate-pulse rounded bg-muted" />
												<div className="h-3 w-24 animate-pulse rounded bg-muted" />
											</div>
										</div>
									))}
								</div>
							) : people.length === 0 ? (
								<p className="py-8 text-center text-muted-foreground text-sm">
									No one to show yet. Follow people to see them here, or be the
									first to get followers.
								</p>
							) : (
								<ul className="flex flex-col">
									{people.map((p) => (
										<li
											key={p.id}
											className={cn(
												"group flex w-full items-center gap-3 rounded-full px-4 py-3 text-left transition-colors duration-100",
												"[@media(hover:hover)]:hover:bg-muted/50",
											)}
										>
											{/* Public profiles live on the profile domain (`*.cura.page`), not an in-app route — use <a> (typed `Link` is for internal routes only). */}
											<a
												href={
													p.username
														? getPublicProfileUrl(p.username)
														: "#"
												}
												className="flex min-w-0 flex-1 items-center gap-3 rounded-full no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
											>
												<div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted">
													{p.image ? (
														<Image
															src={p.image}
															alt=""
															fill
															className="object-cover"
															unoptimized
														/>
													) : (
														<span className="flex size-full items-center justify-center font-semibold text-lg text-muted-foreground">
															{(p.name ?? "?")[0]}
														</span>
													)}
												</div>
												<div className="min-w-0 flex-1">
													<p className="truncate font-semibold text-foreground text-sm">
														{p.name}
													</p>
													<p className="truncate text-muted-foreground text-xs">
														{p.username ? `@${p.username}` : "—"}
													</p>
												</div>
												<span className="shrink-0 text-muted-foreground text-xs">
													{p.followerCount} follower
													{p.followerCount !== 1 ? "s" : ""}
												</span>
											</a>
											{p.username && (
												<button
													type="button"
													onClick={(e) => {
														e.preventDefault();
														if (p.isFollowing) {
															void handleUnfollowUser(p.username);
														} else {
															void handleFollowUser(p.username);
														}
													}}
													className={cn(
														"shrink-0 cursor-pointer rounded-full px-3 py-1.5 font-medium text-xs transition-colors",
														p.isFollowing
															? "border border-border bg-muted text-muted-foreground hover:bg-muted/80"
															: "bg-foreground text-background hover:opacity-90",
													)}
												>
													{p.isFollowing ? "Following" : "Follow"}
												</button>
											)}
										</li>
									))}
								</ul>
							)}
						</motion.div>
					)}

					{segment === "collections" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.15 }}
							className="flex flex-col"
						>
							{loadingCollections ? (
								<div className="flex flex-col py-4">
									{[1, 2, 3, 4, 5].map((i) => (
										<div
											key={i}
											className="flex items-center gap-3 rounded-full px-4 py-3"
										>
											<div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
											<div className="min-w-0 flex-1 space-y-1">
												<div className="h-4 w-40 animate-pulse rounded bg-muted" />
												<div className="h-3 w-28 animate-pulse rounded bg-muted" />
											</div>
										</div>
									))}
								</div>
							) : collections.length === 0 ? (
								<p className="py-8 text-center text-muted-foreground text-sm">
									No public collections with followers yet.
								</p>
							) : (
								<ul className="flex flex-col">
									{collections.map((c) => (
										<li
											key={c.id}
											className={cn(
												"group flex w-full items-center gap-3 rounded-full px-4 py-3 text-left transition-colors duration-100",
												"[@media(hover:hover)]:hover:bg-muted/50",
											)}
										>
											{/* Owner avatar (collections have no image; show who owns it) */}
											<div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted">
												{c.owner?.image ? (
													<Image
														src={c.owner.image}
														alt=""
														fill
														className="object-cover"
														unoptimized
													/>
												) : (
													<span className="flex size-full items-center justify-center font-semibold text-lg text-muted-foreground">
														{(c.owner?.name ?? "?")[0]}
													</span>
												)}
											</div>
											<div className="min-w-0 flex-1">
												<p className="truncate font-semibold text-foreground text-sm">
													{c.name}
												</p>
												<p className="truncate text-muted-foreground text-xs">
													{c.owner?.username
														? `@${c.owner.username}`
														: (c.owner?.name ?? "—")}
													{" · "}
													{c.followerCount} follower
													{c.followerCount !== 1 ? "s" : ""}
													{" · "}
													{c.bookmarkCount} bookmark
													{c.bookmarkCount !== 1 ? "s" : ""}
												</p>
											</div>
											<button
												type="button"
												onClick={() => {
													if (c.isFollowing) {
														void handleUnfollowCollection(c.id);
													} else {
														void handleFollowCollection(c.id);
													}
												}}
												className={cn(
													"shrink-0 cursor-pointer rounded-full px-3 py-1.5 font-medium text-xs transition-colors",
													c.isFollowing
														? "border border-border bg-muted text-muted-foreground hover:bg-muted/80"
														: "bg-foreground text-background hover:opacity-90",
												)}
											>
												{c.isFollowing ? "Following" : "Follow"}
											</button>
										</li>
									))}
								</ul>
							)}
						</motion.div>
					)}

					{segment === "bookmarks" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.15 }}
							className="flex flex-col"
						>
							{loadingBookmarks ? (
								<div className="flex flex-col py-4">
									{[1, 2, 3, 4, 5].map((i) => (
										<div
											key={i}
											className="flex items-center gap-3 rounded-full px-4 py-3"
										>
											<span className="size-5 shrink-0 animate-pulse rounded-sm bg-muted" />
											<div className="min-w-0 flex-1 space-y-1">
												<div className="h-4 w-32 animate-pulse rounded bg-muted" />
												<div className="h-3 w-20 animate-pulse rounded bg-muted" />
											</div>
										</div>
									))}
								</div>
							) : bookmarks.length === 0 ? (
								<p className="py-8 text-center text-muted-foreground text-sm">
									No trending sites yet. Save public bookmarks to see the most
									saved sites here.
								</p>
							) : (
								<ul className="flex flex-col">
									{bookmarks.map((t) => {
										const faviconUrl = t.exampleUrl
											? getFaviconUrl(t.exampleUrl)
											: null;

										return (
											<li key={t.domain}>
												{/* Row opens link; action buttons are separate — div + role="button" required (cannot nest buttons) */}
												{/* biome-ignore lint/a11y/useSemanticElements: see comment above */}
												<div
													role="button"
													tabIndex={0}
													onClick={() => {
														if (t.exampleUrl)
															window.open(
																t.exampleUrl,
																"_blank",
																"noopener,noreferrer",
															);
													}}
													onKeyDown={(e) => {
														if (
															(e.key === "Enter" || e.key === " ") &&
															t.exampleUrl
														) {
															e.preventDefault();
															window.open(
																t.exampleUrl,
																"_blank",
																"noopener,noreferrer",
															);
														}
													}}
													className={cn(
														"group flex w-full cursor-pointer items-center gap-3 rounded-full px-4 py-3 text-left transition-colors duration-100",
														"[@media(hover:hover)]:hover:bg-muted/50",
													)}
													aria-label={`Open ${t.domain}`}
												>
													{/* Favicon — matches bookmark list row */}
													<span className="flex shrink-0 items-center justify-center">
														{faviconUrl ? (
															<Image
																src={faviconUrl}
																alt=""
																width={20}
																height={20}
																unoptimized
																className="size-5 rounded-sm"
																onError={(e) => {
																	(e.target as HTMLImageElement).style.display =
																		"none";
																}}
															/>
														) : (
															<span className="block size-5 rounded-sm bg-muted" />
														)}
													</span>
													{/* Title + save count on one line; count visible on hover (like bookmark domain) */}
													<span className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
														<span className="min-w-0 shrink truncate font-semibold text-foreground text-sm leading-tight">
															{t.domain}
														</span>
														<span
															className="shrink-0 text-muted-foreground/90 text-xs"
															title={`${t.saveCount} save${t.saveCount !== 1 ? "s" : ""}`}
														>
															{t.saveCount} save
															{t.saveCount !== 1 ? "s" : ""}
														</span>
													</span>
													{/* Action buttons: Open link, Save — same hit area as bookmark row */}
													<div className="flex items-center justify-end gap-0.5">
														<DropdownMenu>
															<DropdownMenuTrigger
																render={
																	<button
																		type="button"
																		onClick={(e) => e.stopPropagation()}
																		className={cn(
																			"flex shrink-0 cursor-pointer items-center justify-center rounded-full px-2.5 py-1.5 font-medium text-muted-foreground text-sm transition-colors duration-100",
																			"opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
																			"[@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:group-hover:text-foreground",
																		)}
																		title="Save bookmark"
																		aria-label="Save bookmark"
																	>
																		<TextMorph>Save</TextMorph>
																	</button>
																}
															/>
															<DropdownMenuContent
																align="end"
																className={contextMenuPopupCls}
															>
																<DropdownMenuItem
																	className={contextMenuItemCls}
																	onClick={(e) => {
																		e.stopPropagation();
																		void handleSaveBookmark(t.exampleUrl, null);
																	}}
																>
																	No collection
																</DropdownMenuItem>
																{saveCollections.map((c) => (
																	<DropdownMenuItem
																		key={c.id}
																		className={contextMenuItemCls}
																		onClick={(e) => {
																			e.stopPropagation();
																			void handleSaveBookmark(
																				t.exampleUrl,
																				c.id,
																			);
																		}}
																	>
																		{c.name}
																	</DropdownMenuItem>
																))}
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
												</div>
											</li>
										);
									})}
								</ul>
							)}
						</motion.div>
					)}
				</div>
			</div>
		</main>
	);
}
