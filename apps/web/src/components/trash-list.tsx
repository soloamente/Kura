"use client";

import { useToast } from "@Kura/ui/components/toast";
import { cn } from "@Kura/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCollection } from "@/context/collection-context";
import { api } from "@/lib/api";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Trash list (Interface Craft)
 *
 *    0ms   Fetch completes; list container fades in.
 *    0ms   Rows fade in, y: 4 → 0, scale: 0.98 → 1.0 (160ms, ease-out).
 *  Action  Restore/Delete: row fades out, height collapses (160ms).
 *
 * Emil: short, clear transitions for a low-frequency view; only
 * opacity/transform/height animated to avoid layout jank.
 * ───────────────────────────────────────────────────────── */

interface TrashBookmark {
	id: string;
	url: string;
	title: string | null;
	trashedAt: string | Date | null;
	collection: { id: string; name: string; color: string | null } | null;
}

// Helper to derive a clean domain name from the URL for display.
function getDomain(url: string) {
	try {
		return new URL(url).hostname.replace("www.", "");
	} catch {
		return url;
	}
}

// Helper to render a favicon; matches the main bookmark list style.
function getFaviconUrl(url: string) {
	try {
		const { origin } = new URL(url);
		return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
	} catch {
		return null;
	}
}

function formatRelativeTrashDate(trashedAt: string | Date | null) {
	if (!trashedAt) return "";
	const date = new Date(trashedAt);
	if (Number.isNaN(date.getTime())) return "";

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays <= 0) return "Trashed today";
	if (diffDays === 1) return "Trashed yesterday";
	if (diffDays < 7) return `Trashed ${diffDays} days ago`;
	return `Trashed on ${date.toLocaleDateString()}`;
}

export function TrashList() {
	useCollection();
	const { toast } = useToast();
	const [bookmarks, setBookmarks] = useState<TrashBookmark[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);
	const isInitialLoad = useRef(true);

	// Fetch the current trash contents from the server.
	const fetchTrash = useCallback(async () => {
		if (isInitialLoad.current) setLoading(true);
		const { data, error } = await api.bookmarks.trash.get();

		if (error) {
			console.error("Failed to fetch trash:", error);
			toast("Failed to load trash", "error");
			setLoading(false);
			return;
		}

		if (data && Array.isArray(data)) {
			setBookmarks(
				data
					.map((raw) => {
						const base = raw as Partial<TrashBookmark> & {
							id?: string;
							url?: string;
						};
						if (!base.id || !base.url) return null;
						return {
							id: base.id,
							url: base.url,
							title: base.title ?? null,
							trashedAt: base.trashedAt ?? null,
							collection: base.collection
								? {
										id: base.collection.id,
										name: base.collection.name,
										color: base.collection.color ?? null,
									}
								: null,
						} satisfies TrashBookmark;
					})
					.filter(Boolean) as TrashBookmark[],
			);
		}

		setLoading(false);
		isInitialLoad.current = false;
	}, [toast]);

	useEffect(() => {
		void fetchTrash();
	}, [fetchTrash]);

	// Restore a bookmark from trash back into the main list.
	const handleRestore = async (id: string) => {
		setBusyId(id);
		// Optimistically remove the row from the UI.
		setBookmarks((prev) => prev.filter((b) => b.id !== id));

		const { error } = await api.bookmarks({ id }).restore.patch({});
		setBusyId(null);

		if (error) {
			console.error("Failed to restore bookmark:", error);
			toast("Failed to restore bookmark", "error");
			// Refetch to restore the correct state.
			void fetchTrash();
			return;
		}

		toast("Bookmark restored", "success");
	};

	// Permanently delete a bookmark from trash.
	const handleDelete = async (id: string) => {
		setBusyId(id);
		// Optimistically remove the row from the UI.
		setBookmarks((prev) => prev.filter((b) => b.id !== id));

		const { error } = await api.bookmarks({ id }).delete();
		setBusyId(null);

		if (error) {
			console.error("Failed to delete bookmark:", error);
			toast("Failed to delete bookmark", "error");
			// Refetch to restore the correct state.
			void fetchTrash();
			return;
		}

		toast("Bookmark deleted permanently", "success");
	};

	const handleEmptyTrash = async () => {
		if (bookmarks.length === 0) return;

		const confirmed = window.confirm(
			"Empty trash? Bookmarks older than 7 days will be deleted permanently.",
		);
		if (!confirmed) return;

		const { data, error } = await api.bookmarks.trash.purge.delete();
		if (error) {
			console.error("Failed to empty trash:", error);
			toast("Failed to empty trash", "error");
			return;
		}

		// Refetch to reflect the purged items; keep younger items if any.
		void fetchTrash();

		if (data && typeof data === "object" && "purged" in data) {
			toast(`Emptied ${data.purged} old bookmark(s) from trash`, "success");
		} else {
			toast("Trash emptied", "success");
		}
	};

	const isEmpty = !loading && bookmarks.length === 0;

	return (
		<div className="flex min-h-0 w-full flex-1 justify-center">
			<div className="flex min-h-0 w-full max-w-2xl flex-col gap-4 px-4 pt-2 pb-4">
				{/* Header row with title and optional empty-trash action. */}
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col">
						<h1 className="font-medium text-foreground text-sm">Trash</h1>
						<p className="text-muted-foreground text-xs">
							Bookmarks you moved to trash. Restore or delete permanently.
						</p>
					</div>

					<button
						type="button"
						onClick={handleEmptyTrash}
						disabled={loading || bookmarks.length === 0}
						className={cn(
							"inline-flex h-9 items-center rounded-full border border-border px-3 font-medium text-xs transition-colors",
							"disabled:cursor-not-allowed disabled:opacity-50",
							"[@media(hover:hover)]:hover:bg-muted",
						)}
						aria-disabled={loading || bookmarks.length === 0}
					>
						Empty trash
					</button>
				</div>

				<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
					{loading ? (
						<div className="flex w-full flex-col gap-1 pt-2">
							{[0.9, 0.75, 0.85, 0.6].map((opacity) => (
								<div
									key={opacity}
									className="flex items-center gap-3 px-3 py-2.5"
								>
									<span
										className="size-[18px] shrink-0 animate-pulse rounded-sm bg-muted"
										style={{ opacity }}
									/>
									<span
										className="h-4 flex-1 animate-pulse rounded bg-muted"
										style={{ opacity }}
									/>
									<span
										className="h-3 w-24 shrink-0 animate-pulse rounded bg-muted"
										style={{ opacity: opacity * 0.5 }}
									/>
								</div>
							))}
						</div>
					) : isEmpty ? (
						<div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
							<p className="font-medium text-foreground text-sm">
								Trash is empty
							</p>
							<p className="text-muted-foreground text-xs">
								Move a bookmark to trash to see it here.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-1 pt-2">
							<AnimatePresence initial={false}>
								{bookmarks.map((bookmark) => {
									const domain = getDomain(bookmark.url);
									const faviconUrl = getFaviconUrl(bookmark.url);
									const trashedLabel = formatRelativeTrashDate(
										bookmark.trashedAt,
									);

									return (
										<motion.div
											key={bookmark.id}
											initial={{ opacity: 0, scale: 0.98, y: 4 }}
											animate={{ opacity: 1, scale: 1, y: 0 }}
											exit={{
												opacity: 0,
												scale: 0.98,
												height: 0,
												marginTop: 0,
												marginBottom: 0,
											}}
											transition={{
												duration: 0.16,
												ease: [0.215, 0.61, 0.355, 1],
											}}
										>
											<div className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-100 hover:bg-muted/50">
												<span className="flex size-[18px] shrink-0 items-center justify-center">
													{faviconUrl ? (
														// biome-ignore lint/performance/noImgElement: small favicon, external URL
														<img
															src={faviconUrl}
															alt=""
															className="size-[18px] rounded-sm"
															onError={(event) => {
																(
																	event.target as HTMLImageElement
																).style.display = "none";
															}}
														/>
													) : (
														<span className="block size-[18px] rounded-sm bg-muted" />
													)}
												</span>

												<div className="flex min-w-0 flex-1 flex-col gap-0.5">
													<div className="flex min-w-0 items-baseline gap-2">
														<p className="truncate font-medium text-foreground text-sm">
															{bookmark.title || domain}
														</p>
														<span className="shrink-0 text-muted-foreground text-xs">
															{domain}
														</span>
													</div>

													<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
														{bookmark.collection && (
															<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
																<span
																	className="size-1.5 rounded-full"
																	style={{
																		backgroundColor:
																			bookmark.collection.color ??
																			"hsl(var(--primary))",
																	}}
																/>
																<span className="truncate">
																	{bookmark.collection.name}
																</span>
															</span>
														)}
														{trashedLabel && (
															<span className="truncate">{trashedLabel}</span>
														)}
													</div>
												</div>

												<div className="flex shrink-0 items-center gap-1">
													<button
														type="button"
														onClick={() => handleRestore(bookmark.id)}
														disabled={busyId === bookmark.id}
														className={cn(
															"inline-flex h-8 items-center rounded-full border border-border px-2.5 font-medium text-[11px] transition-colors",
															"disabled:cursor-not-allowed disabled:opacity-50",
															"[@media(hover:hover)]:hover:bg-muted",
														)}
														aria-label="Restore bookmark"
													>
														Restore
													</button>
													<button
														type="button"
														onClick={() => handleDelete(bookmark.id)}
														disabled={busyId === bookmark.id}
														className={cn(
															"inline-flex h-8 items-center rounded-full bg-destructive/10 px-2.5 font-medium text-[11px] text-destructive transition-colors",
															"disabled:cursor-not-allowed disabled:opacity-50",
															"[@media(hover:hover)]:hover:bg-destructive/15",
														)}
														aria-label="Delete bookmark permanently"
													>
														Delete
													</button>
												</div>
											</div>
										</motion.div>
									);
								})}
							</AnimatePresence>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
