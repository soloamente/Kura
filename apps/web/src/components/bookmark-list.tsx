"use client";

import { cn } from "@Kura/ui/lib/utils";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { IconTrashFilled } from "nucleo-micro-bold";
import { useEffect, useRef, useState } from "react";
import { useCollection } from "@/context/collection-context";
import { api } from "@/lib/api";
import { BookmarkTitle } from "./bookmark-title";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bookmark {
	id: string;
	url: string;
	title: string | null;
	description: string | null;
	image: string | null;
	favicon: string | null;
	siteName: string | null;
	isRead: boolean;
	isFavorite: boolean;
	isTrashed: boolean;
	createdAt: Date | string;
	collection: { id: string; name: string; color: string | null } | null;
}

interface BookmarkGroup {
	label: string;
	bookmarks: Bookmark[];
}

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
		const { origin } = new URL(url);
		return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
	} catch {
		return null;
	}
}

function groupByDate(bookmarks: Bookmark[]): BookmarkGroup[] {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const lastWeek = new Date(today);
	lastWeek.setDate(lastWeek.getDate() - 7);
	const lastMonth = new Date(today);
	lastMonth.setDate(lastMonth.getDate() - 30);

	const groups: Record<string, Bookmark[]> = {
		Today: [],
		Yesterday: [],
		"Last week": [],
		"Last month": [],
		Older: [],
	};

	for (const b of bookmarks) {
		const date = new Date(b.createdAt);
		if (date >= today) groups.Today.push(b);
		else if (date >= yesterday) groups.Yesterday.push(b);
		else if (date >= lastWeek) groups["Last week"].push(b);
		else if (date >= lastMonth) groups["Last month"].push(b);
		else groups.Older.push(b);
	}

	return Object.entries(groups)
		.filter(([, items]) => items.length > 0)
		.map(([label, items]) => ({ label, bookmarks: items }));
}

// ─── Duplicate warning dialog ─────────────────────────────────────────────────

function DuplicateDialog({
	url,
	onConfirm,
	onCancel,
}: {
	url: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const domain = getDomain(url);
	const shouldReduceMotion = useReducedMotion();

	return (
		<AnimatePresence>
			<div className="fixed inset-0 z-50 flex items-center justify-center">
				<motion.div
					className="absolute inset-0 bg-background/80 backdrop-blur-sm"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
					onClick={onCancel}
				/>
				<motion.div
					className="relative z-10 mx-4 flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-popover p-5 shadow-xl"
					role="dialog"
					aria-modal="true"
					aria-labelledby="duplicate-dialog-title"
					aria-describedby="duplicate-dialog-description"
					initial={{ opacity: 0, scale: 0.95, y: 8 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 8 }}
					transition={{
						duration: shouldReduceMotion ? 0 : 0.18,
						ease: [0.215, 0.61, 0.355, 1],
					}}
				>
					<div className="flex items-center gap-3">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
							<svg
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5zm0 7a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z"
									fill="currentColor"
								/>
							</svg>
						</span>
						<div>
							<p
								id="duplicate-dialog-title"
								className="font-medium text-foreground text-sm"
							>
								Already saved
							</p>
							<p
								id="duplicate-dialog-description"
								className="mt-0.5 text-muted-foreground text-xs"
							>
								You already have a bookmark for{" "}
								<span className="font-medium text-foreground">{domain}</span>
							</p>
						</div>
					</div>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Do you want to save it again as a duplicate?
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onCancel}
							className="flex-1 rounded-lg border border-border px-3 py-2 font-medium text-foreground text-xs transition-colors hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={onConfirm}
							className="flex-1 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90"
						>
							Save anyway
						</button>
					</div>
				</motion.div>
			</div>
		</AnimatePresence>
	);
}

// ─── Bookmark preview tooltip ─────────────────────────────────────────────────

function BookmarkPreviewContent({ bookmark }: { bookmark: Bookmark }) {
	const domain = getDomain(bookmark.url);

	return (
		<div className="flex w-[260px] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
			{bookmark.image ? (
				<Image
					src={bookmark.image}
					alt=""
					width={260}
					height={146}
					className="aspect-video w-full bg-muted object-cover"
					onError={(e) => {
						(e.target as HTMLImageElement).style.display = "none";
					}}
				/>
			) : (
				<div className="flex aspect-video w-full items-center justify-center bg-muted">
					{getFaviconUrl(bookmark.url) && (
						<Image
							src={getFaviconUrl(bookmark.url) ?? ""}
							alt=""
							width={32}
							height={32}
							className="size-8 opacity-20"
							onError={(e) => {
								(e.target as HTMLImageElement).style.display = "none";
							}}
						/>
					)}
				</div>
			)}
			<div className="flex flex-col gap-2.5 p-3">
				<p className="line-clamp-2 font-medium text-foreground text-sm leading-snug">
					{bookmark.title ?? domain}
				</p>
				{bookmark.description && (
					<p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">
						{bookmark.description}
					</p>
				)}
				{bookmark.collection && (
					<div className="flex items-center gap-1.5">
						<span
							className="size-2 shrink-0 rounded-full"
							style={{
								backgroundColor:
									bookmark.collection.color ?? "hsl(var(--primary))",
							}}
						/>
						<span className="text-muted-foreground text-xs">
							{bookmark.collection.name}
						</span>
					</div>
				)}
				<div className="-mx-1 flex flex-col gap-0.5 border-border border-t pt-2">
					<a
						href={bookmark.url}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-foreground text-xs transition-colors hover:bg-muted"
						onClick={(e) => e.stopPropagation()}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 12 12"
							fill="none"
							className="shrink-0 opacity-50"
							aria-hidden="true"
						>
							<path
								d="M2 2h4v1H3v6h6V7h1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm5 0h3v3h-1V3.707L5.854 6.854l-.708-.708L8.293 3H7V2z"
								fill="currentColor"
							/>
						</svg>
						View on {domain}
					</a>
				</div>
			</div>
		</div>
	);
}

// ─── Bookmark Row ─────────────────────────────────────────────────────────────

function BookmarkRow({
	bookmark,
	onTrash,
	onToggleRead,
	onToggleFavorite,
}: {
	bookmark: Bookmark;
	onTrash: () => void;
	onToggleRead: () => void;
	onToggleFavorite: () => void;
}) {
	const domain = getDomain(bookmark.url);
	const faviconUrl = getFaviconUrl(bookmark.url);

	return (
		<ContextMenu.Root>
			<ContextMenu.Trigger
				render={(triggerProps) => (
					<Tooltip.Root>
						<Tooltip.Trigger
							render={
								<button
									{...triggerProps}
									type="button"
									onClick={() => {
										window.open(bookmark.url, "_blank", "noopener,noreferrer");
									}}
									className={cn(
										"group flex w-full cursor-pointer items-center gap-3 rounded-full px-3.5 py-3.25 text-left transition-colors duration-100",
										"[@media(hover:hover)]:hover:bg-muted/50",
										typeof triggerProps.className === "string"
											? triggerProps.className
											: undefined,
									)}
								/>
							}
						>
							{/* unread indicator */}
							<span
								className={cn(
									"size-1.5 shrink-0 rounded-full transition-colors duration-200",
									bookmark.isRead ? "bg-transparent" : "bg-primary",
								)}
							/>
							{/* favicon */}
							<span className="flex shrink-0 items-center justify-center">
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

							{/* title + domain */}
							<span className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
								<BookmarkTitle
									bookmarkId={bookmark.id}
									initialTitle={bookmark.title}
									url={bookmark.url}
									autoGenerate={true}
									className={cn("text-sm", !bookmark.isRead && "font-medium")}
								/>
								<span className="shrink-0 text-muted-foreground text-xs">
									{domain}
								</span>
							</span>

							{/* favorite star — always visible if favorited, hover-only otherwise */}
							<div
								role="button"
								tabIndex={0}
								onClick={(e) => {
									e.stopPropagation();
									onToggleFavorite();
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										e.stopPropagation();
										onToggleFavorite();
									}
								}}
								className={cn(
									"flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-100",
									"[@media(hover:hover)]:hover:bg-muted",
									bookmark.isFavorite
										? "text-amber-400"
										: "text-muted-foreground opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
								)}
								title={
									bookmark.isFavorite
										? "Remove from favorites"
										: "Add to favorites"
								}
								aria-label={
									bookmark.isFavorite
										? "Remove from favorites"
										: "Add to favorites"
								}
							>
								{bookmark.isFavorite ? "★" : "☆"}
							</div>

							{/* trash — hover only */}
							<div
								role="button"
								tabIndex={0}
								onClick={(e) => {
									e.stopPropagation();
									onTrash();
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										e.stopPropagation();
										onTrash();
									}
								}}
								className={cn(
									"flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md",
									"text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
									"opacity-0 transition-colors duration-100 [@media(hover:hover)]:group-hover:opacity-100",
								)}
								title="Move to trash"
								aria-label="Move bookmark to trash"
							>
								<IconTrashFilled size={16} />
							</div>
						</Tooltip.Trigger>

						<Tooltip.Portal>
							<Tooltip.Positioner side="right" sideOffset={12} align="start">
								<Tooltip.Popup className="outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
									<BookmarkPreviewContent bookmark={bookmark} />
								</Tooltip.Popup>
							</Tooltip.Positioner>
						</Tooltip.Portal>
					</Tooltip.Root>
				)}
			/>

			<ContextMenu.Portal>
				<ContextMenu.Backdrop className="fixed inset-0 bg-transparent" />
				<ContextMenu.Positioner>
					<ContextMenu.Popup className="z-50 min-w-[180px] rounded-lg border border-border bg-popover py-1 text-xs shadow-lg">
						<ContextMenu.Item
							className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-foreground outline-none data-highlighted:bg-muted"
							onClick={() =>
								window.open(bookmark.url, "_blank", "noopener,noreferrer")
							}
						>
							Open link
						</ContextMenu.Item>

						<ContextMenu.Item
							className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-foreground outline-none data-highlighted:bg-muted"
							onClick={() => {
								if (typeof navigator !== "undefined" && navigator.clipboard) {
									navigator.clipboard.writeText(bookmark.url).catch((err) => {
										console.error("Failed to copy URL:", err);
									});
								}
							}}
						>
							Copy URL
						</ContextMenu.Item>

						<ContextMenu.Separator className="my-1 h-px bg-border" />

						<ContextMenu.Item
							className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-foreground outline-none data-highlighted:bg-muted"
							onClick={onToggleRead}
						>
							{bookmark.isRead ? "Mark as unread" : "Mark as read"}
						</ContextMenu.Item>

						<ContextMenu.Item
							className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-foreground outline-none data-highlighted:bg-muted"
							onClick={onToggleFavorite}
						>
							{bookmark.isFavorite
								? "Remove from favorites"
								: "Add to favorites"}
						</ContextMenu.Item>

						<ContextMenu.Separator className="my-1 h-px bg-border" />

						<ContextMenu.Item
							className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-destructive outline-none data-highlighted:bg-destructive/10"
							onClick={onTrash}
						>
							Move to trash
						</ContextMenu.Item>
					</ContextMenu.Popup>
				</ContextMenu.Positioner>
			</ContextMenu.Portal>
		</ContextMenu.Root>
	);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
	return (
		<div className="flex w-full flex-col gap-1 pt-2">
			{[0.9, 0.75, 0.85, 0.6, 0.7, 0.8, 0.5].map((opacity, i) => (
				<div key={i} className="flex items-center gap-3 px-3 py-2.5">
					<span className="size-1.5 shrink-0 rounded-full bg-muted" />
					<span
						className="size-[18px] shrink-0 animate-pulse rounded-sm bg-muted"
						style={{ opacity }}
					/>
					<span
						className="h-4 animate-pulse rounded bg-muted"
						style={{ opacity, flex: `${opacity}` }}
					/>
					<span
						className="h-3 w-20 shrink-0 animate-pulse rounded bg-muted"
						style={{ opacity: opacity * 0.5 }}
					/>
				</div>
			))}
		</div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function BookmarkList() {
	const {
		activeCollectionId,
		bookmarkRefetchKey,
		triggerBookmarkRefetch,
		searchQuery,
	} = useCollection();
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [loading, setLoading] = useState(true);
	const [duplicateUrl, setDuplicateUrl] = useState<string | null>(null);
	const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(
		null,
	);
	const isInitialLoad = useRef(true);
	const shouldReduceMotion = useReducedMotion();

	useEffect(() => {
		const fetchBookmarks = async () => {
			if (isInitialLoad.current) setLoading(true);
			const { data, error } = await api.bookmarks.get();
			if (error) {
				console.error(error);
				setLoading(false);
				return;
			}
			if (data && Array.isArray(data)) setBookmarks(data as Bookmark[]);
			setLoading(false);
			isInitialLoad.current = false;
		};
		fetchBookmarks();
	}, [activeCollectionId, bookmarkRefetchKey]);

	useEffect(() => {
		isInitialLoad.current = true;
	}, [activeCollectionId]);

	// ─── optimistic update helper ─────────────────────────────────────────────
	const updateBookmark = (id: string, patch: Partial<Bookmark>) => {
		setBookmarks((prev) =>
			prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
		);
	};

	// ─── trash ────────────────────────────────────────────────────────────────
	const handleTrash = async (bookmarkId: string) => {
		setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
		const { error } = await api.bookmarks({ id: bookmarkId }).trash.patch({});
		if (error) {
			console.error("Failed to trash bookmark:", error);
			triggerBookmarkRefetch();
		}
	};

	// ─── read/unread ──────────────────────────────────────────────────────────
	const handleToggleRead = async (bookmark: Bookmark) => {
		const nextRead = !bookmark.isRead;
		updateBookmark(bookmark.id, { isRead: nextRead });
		const endpoint = nextRead
			? api.bookmarks({ id: bookmark.id }).read.patch
			: api.bookmarks({ id: bookmark.id }).unread.patch;
		const { error } = await endpoint({});
		if (error) {
			console.error("Failed to toggle read:", error);
			updateBookmark(bookmark.id, { isRead: bookmark.isRead }); // revert
		}
	};

	// ─── favorite ─────────────────────────────────────────────────────────────
	const handleToggleFavorite = async (bookmark: Bookmark) => {
		const nextFav = !bookmark.isFavorite;
		updateBookmark(bookmark.id, { isFavorite: nextFav });
		const { error } = await api
			.bookmarks({ id: bookmark.id })
			.favorite.patch({});
		if (error) {
			console.error("Failed to toggle favorite:", error);
			updateBookmark(bookmark.id, { isFavorite: bookmark.isFavorite }); // revert
		}
	};

	// ─── duplicate dialog ─────────────────────────────────────────────────────
	const handleDuplicateConfirm = async () => {
		if (!duplicateUrl) return;
		const { data, error } = await api.bookmarks.force.post({
			url: duplicateUrl,
			collectionId: pendingCollectionId,
		});
		setDuplicateUrl(null);
		setPendingCollectionId(null);
		if (!error && data && "id" in data) triggerBookmarkRefetch();
	};

	const handleDuplicateCancel = () => {
		setDuplicateUrl(null);
		setPendingCollectionId(null);
	};

	useEffect(() => {
		const handler = (e: Event) => {
			const { url, collectionId } = (e as CustomEvent).detail;
			setDuplicateUrl(url);
			setPendingCollectionId(collectionId ?? null);
		};
		window.addEventListener("bookmark:duplicate", handler);
		return () => window.removeEventListener("bookmark:duplicate", handler);
	}, []);

	const filtered = bookmarks
		.filter(
			(b) =>
				activeCollectionId === null || b.collection?.id === activeCollectionId,
		)
		.filter((b) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				b.title?.toLowerCase().includes(q) ||
				b.url.toLowerCase().includes(q) ||
				b.description?.toLowerCase().includes(q) ||
				b.siteName?.toLowerCase().includes(q)
			);
		});

	const groups = groupByDate(filtered);
	let rowIndex = 0;

	return (
		<>
			{duplicateUrl && (
				<DuplicateDialog
					url={duplicateUrl}
					onConfirm={handleDuplicateConfirm}
					onCancel={handleDuplicateCancel}
				/>
			)}

			<div className="flex min-h-0 w-full flex-1 justify-center">
				<div className="flex min-h-0 w-full max-w-2xl gap-4 px-4 pt-4 pb-4">
					<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
						{loading ? (
							<SkeletonRows />
						) : (
							<div className="flex flex-col gap-4">
								{groups.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
										<p className="font-medium text-foreground text-sm">
											No bookmarks yet
										</p>
										<p className="text-muted-foreground text-xs">
											Press{" "}
											<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
												⌘V
											</kbd>{" "}
											anywhere to save a link
										</p>
									</div>
								) : (
									<div className="flex flex-col">
										<AnimatePresence initial={!shouldReduceMotion}>
											{groups.map((group) =>
												group.bookmarks.map((b) => {
													const index = rowIndex++;
													return (
														<motion.div
															key={b.id}
															initial={{ opacity: 0, scale: 0.96, y: -4 }}
															animate={{ opacity: 1, scale: 1, y: 0 }}
															exit={{
																opacity: 0,
																scale: 0.96,
																height: 0,
																marginBottom: 0,
															}}
															transition={
																shouldReduceMotion
																	? { duration: 0 }
																	: {
																			duration: 0.2,
																			ease: [0.215, 0.61, 0.355, 1],
																			delay: index * 0.03,
																		}
															}
														>
															<BookmarkRow
																bookmark={b}
																onTrash={() => handleTrash(b.id)}
																onToggleRead={() => handleToggleRead(b)}
																onToggleFavorite={() => handleToggleFavorite(b)}
															/>
														</motion.div>
													);
												}),
											)}
										</AnimatePresence>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
