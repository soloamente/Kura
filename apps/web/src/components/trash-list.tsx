"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { cn } from "@Kura/ui/lib/utils";

/* ─────────────────────────────────────────────────────────
 * Two sections:
 *   1. Trashed collections — shown at top with bookmark count + restore
 *   2. Trashed bookmarks — individual bookmarks (existing behaviour)
 *
 * Restoring a collection fires "collection:restored" so the Header
 * refetches its list and the chip re-appears.
 * ───────────────────────────────────────────────────────── */

interface TrashBookmark {
	id: string;
	url: string;
	title: string | null;
	trashedAt: string | Date | null;
	collection: { id: string; name: string; color: string | null } | null;
}

interface TrashCollection {
	id: string;
	name: string;
	color: string | null;
	trashedAt: string | Date | null;
	bookmarks: { id: string }[];
}

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

function formatRelativeTrashDate(trashedAt: string | Date | null) {
	if (!trashedAt) return "";
	const date = new Date(trashedAt);
	if (Number.isNaN(date.getTime())) return "";
	const now = new Date();
	const diffDays = Math.floor(
		(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
	);
	if (diffDays <= 0) return "Trashed today";
	if (diffDays === 1) return "Trashed yesterday";
	if (diffDays < 7) return `Trashed ${diffDays} days ago`;
	return `Trashed on ${date.toLocaleDateString()}`;
}

// ─── Folder icon ──────────────────────────────────────────────────────────────

function FolderIcon({ color }: { color: string | null }) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden="true"
			className="shrink-0"
		>
			<path
				d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3.379a1.5 1.5 0 0 1 1.06.44l.622.62H14.5A1.5 1.5 0 0 1 16 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 2 13.5v-9z"
				fill={color ?? "hsl(var(--primary))"}
				opacity="0.2"
			/>
			<path
				d="M3.5 3A1.5 1.5 0 0 0 2 4.5v9A1.5 1.5 0 0 0 3.5 15h11A1.5 1.5 0 0 0 16 13.5v-8A1.5 1.5 0 0 0 14.5 4H8.56l-.621-.62A1.5 1.5 0 0 0 6.879 3H3.5z"
				stroke={color ?? "hsl(var(--primary))"}
				strokeWidth="0.75"
				fill="none"
			/>
		</svg>
	);
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="px-3 py-2 text-xs text-muted-foreground select-none">
			{children}
		</p>
	);
}

// ─── Trashed collection row ───────────────────────────────────────────────────

function TrashedCollectionRow({
	collection,
	onRestore,
	onDelete,
	busy,
}: {
	collection: TrashCollection;
	onRestore: () => void;
	onDelete: () => void;
	busy: boolean;
}) {
	const count = collection.bookmarks.length;
	const trashedLabel = formatRelativeTrashDate(collection.trashedAt);

	return (
		<div className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-100 hover:bg-muted/50">
			<FolderIcon color={collection.color} />

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="truncate text-sm font-medium text-foreground">
					{collection.name}
				</p>
				<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
					<span>
						{count === 0
							? "No bookmarks"
							: count === 1
								? "1 bookmark"
								: `${count} bookmarks`}
					</span>
					{trashedLabel && <span>· {trashedLabel}</span>}
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-1">
				<button
					type="button"
					onClick={onRestore}
					disabled={busy}
					className={cn(
						"inline-flex h-8 items-center rounded-full border border-border px-2.5 text-[11px] font-medium transition-colors",
						"disabled:cursor-not-allowed disabled:opacity-50",
						"[@media(hover:hover)]:hover:bg-muted",
					)}
				>
					Restore
				</button>
				<button
					type="button"
					onClick={onDelete}
					disabled={busy}
					className={cn(
						"inline-flex h-8 items-center rounded-full bg-destructive/10 px-2.5 text-[11px] font-medium text-destructive transition-colors",
						"disabled:cursor-not-allowed disabled:opacity-50",
						"[@media(hover:hover)]:hover:bg-destructive/15",
					)}
				>
					Delete
				</button>
			</div>
		</div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TrashList() {
	const [bookmarks, setBookmarks] = useState<TrashBookmark[]>([]);
	const [collections, setCollections] = useState<TrashCollection[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);

	const fetchTrash = useCallback(async () => {
		setLoading(true);

		const [bookmarksRes, collectionsRes] = await Promise.all([
			api.bookmarks.trash.get(),
			api.collections.trash.get(),
		]);

		if (bookmarksRes.error) {
			console.error("Failed to fetch trashed bookmarks:", bookmarksRes.error);
			toast.error("Failed to load trash");
		} else if (bookmarksRes.data && Array.isArray(bookmarksRes.data)) {
			setBookmarks(
				bookmarksRes.data
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

		if (collectionsRes.error) {
			console.error(
				"Failed to fetch trashed collections:",
				collectionsRes.error,
			);
		} else if (collectionsRes.data && Array.isArray(collectionsRes.data)) {
			setCollections(
				collectionsRes.data
					.map((raw) => {
						const base = raw as Partial<TrashCollection> & {
							id?: string;
							name?: string;
						};
						if (!base.id || !base.name) return null;
						return {
							id: base.id,
							name: base.name,
							color: (base as { color?: string | null }).color ?? null,
							trashedAt: base.trashedAt ?? null,
							bookmarks: Array.isArray(base.bookmarks) ? base.bookmarks : [],
						} satisfies TrashCollection;
					})
					.filter(Boolean) as TrashCollection[],
			);
		}

		setLoading(false);
	}, []);

	useEffect(() => {
		void fetchTrash();
	}, [fetchTrash]);

	// ─── bookmark actions ─────────────────────────────────────────────────────

	const handleRestoreBookmark = async (id: string) => {
		setBusyId(id);
		setBookmarks((prev) => prev.filter((b) => b.id !== id));
		const { error } = await api.bookmarks({ id }).restore.patch({});
		setBusyId(null);
		if (error) {
			toast.error("Failed to restore bookmark");
			void fetchTrash();
			return;
		}
		toast.success("Bookmark restored");
	};

	const handleDeleteBookmark = async (id: string) => {
		setBusyId(id);
		setBookmarks((prev) => prev.filter((b) => b.id !== id));
		const { error } = await api.bookmarks({ id }).delete();
		setBusyId(null);
		if (error) {
			toast.error("Failed to delete bookmark");
			void fetchTrash();
			return;
		}
		toast.success("Bookmark deleted permanently");
	};

	// ─── collection actions ───────────────────────────────────────────────────

	const handleRestoreCollection = async (id: string) => {
		setBusyId(id);
		// optimistically remove from trash UI
		setCollections((prev) => prev.filter((c) => c.id !== id));

		const { error } = await api.collections({ id }).restore.patch({});
		setBusyId(null);

		if (error) {
			toast.error("Failed to restore collection");
			void fetchTrash();
			return;
		}

		// fire event so Header refetches and re-adds the chip
		window.dispatchEvent(new CustomEvent("collection:restored"));
		// also refetch bookmarks in trash (some may have been restored too)
		void fetchTrash();
		toast.success("Collection restored");
	};

	const handleDeleteCollection = async (id: string) => {
		setBusyId(id);
		setCollections((prev) => prev.filter((c) => c.id !== id));

		// hard delete the collection — also hard delete its trashed bookmarks
		const { error } = await api.collections({ id }).delete();
		setBusyId(null);

		if (error) {
			toast.error("Failed to delete collection");
			void fetchTrash();
			return;
		}

		// also remove its bookmarks from the local list
		setBookmarks((prev) => prev.filter((b) => b.collection?.id !== id));
		toast.success("Collection deleted permanently");
	};

	const handleEmptyTrash = async () => {
		if (bookmarks.length === 0 && collections.length === 0) return;
		const confirmed = window.confirm(
			"Empty trash? Everything older than 7 days will be permanently deleted.",
		);
		if (!confirmed) return;

		await Promise.all([
			api.bookmarks.trash.purge.delete(),
			api.collections.trash.purge.delete(),
		]);

		void fetchTrash();
		toast.success("Trash emptied");
	};

	const isEmpty =
		!loading && bookmarks.length === 0 && collections.length === 0;

	return (
		<div className="flex flex-1 min-h-0 w-full justify-center">
			<div className="flex w-full max-w-2xl min-h-0 flex-col gap-4 px-4 pb-4 pt-2">
				{/* header row */}
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col">
						<h1 className="text-sm font-medium text-foreground">Trash</h1>
						<p className="text-xs text-muted-foreground">
							Items are permanently deleted after 7 days.
						</p>
					</div>
					<button
						type="button"
						onClick={handleEmptyTrash}
						disabled={loading || isEmpty}
						className={cn(
							"inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-medium transition-colors",
							"disabled:cursor-not-allowed disabled:opacity-50",
							"[@media(hover:hover)]:hover:bg-muted",
						)}
					>
						Empty trash
					</button>
				</div>

				<div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
					{loading ? (
						<div className="flex w-full flex-col gap-1 pt-2">
							{[0.9, 0.75, 0.85, 0.6].map((opacity, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton only
								<div key={i} className="flex items-center gap-3 px-3 py-2.5">
									<span
										className="size-[18px] rounded-sm bg-muted shrink-0 animate-pulse"
										style={{ opacity }}
									/>
									<span
										className="h-4 rounded bg-muted animate-pulse flex-1"
										style={{ opacity }}
									/>
									<span
										className="h-3 rounded bg-muted animate-pulse w-24 shrink-0"
										style={{ opacity: opacity * 0.5 }}
									/>
								</div>
							))}
						</div>
					) : isEmpty ? (
						<div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
							<p className="text-sm font-medium text-foreground">
								Trash is empty
							</p>
							<p className="text-xs text-muted-foreground">
								Move a bookmark or collection to trash to see it here.
							</p>
						</div>
					) : (
						<div className="flex flex-col">
							{/* ── Trashed collections ── */}
							<AnimatePresence initial={false}>
								{collections.length > 0 && (
									<motion.div
										key="collections-section"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0, height: 0 }}
										transition={{ duration: 0.16 }}
									>
										<SectionLabel>Collections</SectionLabel>
										<div className="flex flex-col mb-2">
											<AnimatePresence initial={false}>
												{collections.map((coll) => (
													<motion.div
														key={coll.id}
														initial={{ opacity: 0, scale: 0.98, y: 4 }}
														animate={{ opacity: 1, scale: 1, y: 0 }}
														exit={{ opacity: 0, scale: 0.98, height: 0 }}
														transition={{
															duration: 0.16,
															ease: [0.215, 0.61, 0.355, 1],
														}}
													>
														<TrashedCollectionRow
															collection={coll}
															onRestore={() => handleRestoreCollection(coll.id)}
															onDelete={() => handleDeleteCollection(coll.id)}
															busy={busyId === coll.id}
														/>
													</motion.div>
												))}
											</AnimatePresence>
										</div>
									</motion.div>
								)}
							</AnimatePresence>

							{/* ── Trashed bookmarks ── */}
							<AnimatePresence initial={false}>
								{bookmarks.length > 0 && (
									<motion.div
										key="bookmarks-section"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0, height: 0 }}
										transition={{ duration: 0.16 }}
									>
										{collections.length > 0 && (
											<SectionLabel>Bookmarks</SectionLabel>
										)}
										<div className="flex flex-col gap-1 pt-1">
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
																		<img
																			src={faviconUrl}
																			alt=""
																			className="size-[18px] rounded-sm"
																			onError={(e) => {
																				(
																					e.target as HTMLImageElement
																				).style.display = "none";
																			}}
																		/>
																	) : (
																		<span className="size-[18px] rounded-sm bg-muted block" />
																	)}
																</span>

																<div className="flex min-w-0 flex-1 flex-col gap-0.5">
																	<div className="flex min-w-0 items-baseline gap-2">
																		<p className="truncate text-sm font-medium text-foreground">
																			{bookmark.title || domain}
																		</p>
																		<span className="shrink-0 text-xs text-muted-foreground">
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
																			<span className="truncate">
																				{trashedLabel}
																			</span>
																		)}
																	</div>
																</div>

																<div className="flex shrink-0 items-center gap-1">
																	<button
																		type="button"
																		onClick={() =>
																			handleRestoreBookmark(bookmark.id)
																		}
																		disabled={busyId === bookmark.id}
																		className={cn(
																			"inline-flex h-8 items-center rounded-full border border-border px-2.5 text-[11px] font-medium transition-colors",
																			"disabled:cursor-not-allowed disabled:opacity-50",
																			"[@media(hover:hover)]:hover:bg-muted",
																		)}
																	>
																		Restore
																	</button>
																	<button
																		type="button"
																		onClick={() =>
																			handleDeleteBookmark(bookmark.id)
																		}
																		disabled={busyId === bookmark.id}
																		className={cn(
																			"inline-flex h-8 items-center rounded-full bg-destructive/10 px-2.5 text-[11px] font-medium text-destructive transition-colors",
																			"disabled:cursor-not-allowed disabled:opacity-50",
																			"[@media(hover:hover)]:hover:bg-destructive/15",
																		)}
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
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
