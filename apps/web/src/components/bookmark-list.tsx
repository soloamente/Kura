"use client";

import { useToast } from "@Kura/ui/components/toast";
import { cn } from "@Kura/ui/lib/utils";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
	IconGlobe2,
	IconLockFilled,
	IconStar,
	IconStarFilled,
	IconTagFilled,
	IconTrashFilled,
	IconUsersFilled,
} from "nucleo-micro-bold";
import { useEffect, useRef, useState } from "react";
import { useCollection } from "@/context/collection-context";
import { api } from "@/lib/api";
import {
	contextMenuDestructiveItemCls,
	contextMenuItemCls,
	contextMenuPopupCls,
	contextMenuSeparatorCls,
	contextMenuSubmenuTriggerCls,
	contextMenuSubPopupCls,
} from "@/lib/context-menu-styles";
import { BookmarkTitle } from "./bookmark-title";
import { CreateTagDialog } from "./create-tag-dialog";
import { EditBookmarkSheet } from "./edit-bookmark-sheet";
import { EditTagDialog } from "./edit-tag-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────
// Tags are stored separately in the DB and joined onto bookmarks; we normalize
// the nested relation into this flat shape for the dashboard list.

interface Tag {
	id: string;
	name: string;
	color: string | null;
}

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
	visibility: "private" | "friends" | "public";
	createdAt: Date | string;
	collection: { id: string; name: string; color: string | null } | null;
	// Present when this bookmark comes from a friend-share instead of the owner's
	// own inbox. Shared bookmarks are rendered read-only in the UI.
	sharedFrom?: { name: string | null; username: string | null } | null;
	// When bookmarks are fetched from the owner inbox, this is populated from the
	// joined bookmarkTag relation; for followed/public feeds it may be omitted.
	tags?: Tag[];
}

interface Collection {
	id: string;
	name: string;
}

interface BookmarkGroup {
	label: string;
	bookmarks: Bookmark[];
}

interface ShareTarget {
	type: "bookmark";
	id: string;
	title: string;
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

// ─── Bookmark preview tooltip ─────────────────────────────────────────────────

function BookmarkPreviewContent({ bookmark }: { bookmark: Bookmark }) {
	const domain = getDomain(bookmark.url);

	return (
		<div className="flex w-[260px] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
			{bookmark.image ? (
				// unoptimized: og:images come from arbitrary domains — bypass Next.js
				// image proxy so a slow/broken upstream never throws a server error.
				<Image
					src={bookmark.image}
					alt=""
					width={260}
					height={146}
					unoptimized
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
							unoptimized
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

function ShareToFriendDialog({
	target,
	onClose,
}: {
	target: ShareTarget | null;
	onClose: () => void;
}) {
	const { toast } = useToast();
	const [friends, setFriends] = useState<
		Array<{ id: string; name: string | null; username: string | null }>
	>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	useEffect(() => {
		if (!target) return;
		let cancelled = false;
		const load = async () => {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/friends`,
					{ credentials: "include" },
				);
				if (!res.ok) throw new Error();
				const data = (await res.json()) as {
					friends: Array<{
						id: string;
						name: string | null;
						username: string | null;
					}>;
				};
				if (!cancelled) {
					setFriends(data.friends ?? []);
					if (data.friends?.[0]) setSelectedId(data.friends[0].id);
				}
			} catch {
				if (!cancelled) toast("Failed to load friends", "error");
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [toast, target]);

	if (!target) return null;

	const handleShare = async () => {
		if (!selectedId) return;
		const friend = friends.find((f) => f.id === selectedId);
		if (!friend || !friend.username) {
			toast("Friend username is unavailable", "error");
			return;
		}
		setBusy(true);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/share`,
				{
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						bookmarkId: target.id,
						recipientUsername: friend.username,
					}),
				},
			);
			const body = (await res.json().catch(
				() =>
					({}) as {
						message?: string;
						alreadyShared?: boolean;
					},
			)) as {
				message?: string;
				alreadyShared?: boolean;
			};
			if (!res.ok) {
				toast(body.message ?? "Failed to share", "error");
				return;
			}
			if (body.alreadyShared) {
				toast(
					`You already shared this bookmark with ${
						friend.name ||
						(friend.username ? `@${friend.username}` : "this friend")
					}`,
					"error",
				);
				return;
			}
			toast(
				`Shared with ${friend.name || (friend.username ? `@${friend.username}` : "friend")}`,
				"success",
			);
			onClose();
		} catch {
			toast("Failed to share", "error");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
			{/* biome-ignore lint/a11y/useSemanticElements: overlay backdrop; keyboard handled via onKeyDown */}
			<div
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				role="button"
				tabIndex={0}
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onClose();
					}
				}}
				aria-label="Close dialog"
			/>
			<div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-popover p-4 shadow-2xl">
				<h2 className="font-semibold text-base text-foreground">
					Share to friend
				</h2>
				<p className="mt-0.5 text-muted-foreground text-xs">
					Bookmark: {target.title}
				</p>

				{loading ? (
					<div className="mt-4 space-y-2">
						<div className="h-8 animate-pulse rounded-lg bg-muted" />
						<div className="h-8 animate-pulse rounded-lg bg-muted" />
					</div>
				) : friends.length === 0 ? (
					<p className="mt-4 text-muted-foreground text-xs">
						You don&apos;t have any friends yet. Add some from Settings →
						Friends.
					</p>
				) : (
					<div className="mt-4 flex flex-col gap-2">
						<label
							htmlFor="share-friend-select"
							className="font-medium text-muted-foreground text-xs"
						>
							Choose a friend
						</label>
						<select
							id="share-friend-select"
							value={selectedId ?? ""}
							onChange={(e) => setSelectedId(e.target.value || null)}
							className="h-9 w-full rounded-lg border border-border bg-muted/40 px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						>
							{friends.map((f) => (
								<option key={f.id} value={f.id}>
									{f.name || f.username || "Unknown"}
									{f.username ? ` (@${f.username})` : ""}
								</option>
							))}
						</select>
					</div>
				)}

				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="h-8 cursor-pointer rounded-lg border border-border px-3 font-medium text-muted-foreground text-xs hover:bg-muted"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleShare}
						disabled={busy || loading || !selectedId || friends.length === 0}
						className="h-8 cursor-pointer rounded-lg bg-primary px-3 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{busy ? "Sharing…" : "Share"}
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── Bookmark Row ─────────────────────────────────────────────────────────────

function BookmarkRow({
	bookmark,
	collections,
	onTrash,
	onToggleRead,
	onToggleFavorite,
	onMoveToCollection,
	onChangeVisibility,
	// Tag editing callbacks are optional so followed/read-only contexts can pass
	// nothing and the Tags submenu stays hidden.
	allTags,
	onChangeTags,
	onCreateTag,
	onEditTag,
	onEdit,
	readOnly = false,
}: {
	bookmark: Bookmark;
	collections: Collection[];
	onTrash: () => void;
	onToggleRead: () => void;
	onToggleFavorite: () => void;
	onMoveToCollection: (collectionId: string | null) => void;
	onChangeVisibility?: (visibility: "private" | "friends" | "public") => void;
	allTags?: Tag[];
	onChangeTags?: (tagIds: string[]) => void;
	onCreateTag?: (name: string, color?: string | null) => Promise<Tag | null>;
	onEditTag?: (
		tag: Tag,
		patch: { name: string; color: string | null },
	) => Promise<void>;
	onEdit?: () => void;
	readOnly?: boolean;
}) {
	const domain = getDomain(bookmark.url);
	const faviconUrl = getFaviconUrl(bookmark.url);
	// Keep a quick lookup of which tags are assigned to this bookmark so the
	// context menu can render checkbox state without recomputing on each click.
	const assignedTagIds = (bookmark.tags ?? []).map((t) => t.id);
	const [showCreateTagDialog, setShowCreateTagDialog] = useState(false);
	const [editingTag, setEditingTag] = useState<Tag | null>(null);

	// Create tag and attach to this bookmark; throws on failure for dialog error display.
	const handleCreateAndAttach = async (name: string, color?: string | null) => {
		const tag = await onCreateTag?.(name.trim(), color);
		if (!tag) throw new Error("Failed to create tag");
		const nextIds = new Set(assignedTagIds);
		nextIds.add(tag.id);
		onChangeTags?.(Array.from(nextIds));
	};

	return (
		<>
			<ContextMenu.Root>
				<ContextMenu.Trigger
					render={(triggerProps) => (
						<Tooltip.Root>
							<Tooltip.Trigger
								render={
									<button
										{...triggerProps}
										type="button"
										onClick={() =>
											window.open(bookmark.url, "_blank", "noopener,noreferrer")
										}
										className={cn(
											"group flex w-full cursor-pointer items-center gap-3 rounded-full px-3.5 py-2.5 text-left transition-colors duration-100",
											"[@media(hover:hover)]:hover:bg-muted/50",
											typeof triggerProps.className === "string"
												? triggerProps.className
												: undefined,
										)}
									/>
								}
							>
								{/* tag pill(s) — replaces unread dot; shows first few tags as colored pills */}
								<motion.div
									className="flex shrink-0 flex-wrap items-center gap-1"
									layout
									transition={{
										layout: { duration: 0.18, ease: [0.215, 0.61, 0.355, 1] },
									}}
								>
									{(bookmark.tags ?? []).slice(0, 3).map((t, idx) => (
										<motion.span
											key={t.id}
											initial={{ opacity: 0, y: -4, scale: 0.9 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: -4, scale: 0.9 }}
											transition={{
												duration: 0.18,
												ease: [0.215, 0.61, 0.355, 1],
												delay: idx * 0.02,
											}}
											className={cn(
												"inline-flex max-w-[4rem] shrink-0 items-center gap-0.5 truncate rounded-full px-1.5 py-0.5 font-medium text-[10px]",
												t.color
													? "border border-border/50 text-foreground"
													: "border border-border bg-muted text-muted-foreground",
											)}
											style={
												t.color
													? { backgroundColor: `${t.color}20` }
													: undefined
											}
											title={t.name}
										>
											{t.color && (
												<span
													className="size-1.5 shrink-0 rounded-full"
													style={{ backgroundColor: t.color }}
													aria-hidden="true"
												/>
											)}
											<span className="truncate">{t.name}</span>
										</motion.span>
									))}
									{(bookmark.tags?.length ?? 0) > 3 && (
										<motion.span
											initial={{ opacity: 0, y: -4, scale: 0.9 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: -4, scale: 0.9 }}
											transition={{
												duration: 0.18,
												ease: [0.215, 0.61, 0.355, 1],
											}}
											className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground"
										>
											+{(bookmark.tags?.length ?? 0) - 3}
										</motion.span>
									)}
								</motion.div>

								{/* favicon */}
								<span className="flex shrink-0 items-center justify-center">
									{faviconUrl ? (
										// unoptimized: favicons are fetched from Google's S2 service
										// and may occasionally fail — load directly to avoid server errors.
										<Image
											src={faviconUrl}
											alt=""
											width={20}
											height={20}
											unoptimized
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
										{bookmark.sharedFrom
											? `Shared by ${
													bookmark.sharedFrom.name ||
													(bookmark.sharedFrom.username
														? `@${bookmark.sharedFrom.username}`
														: "friend")
												}`
											: domain}
									</span>
								</span>
								<div className="flex items-center justify-end">
									{/* visibility icon — hidden in read-only mode; div used to avoid nesting button inside row */}
									{!readOnly && onChangeVisibility && (
										// biome-ignore lint/a11y/useSemanticElements: row is interactive; nesting <button> invalid
										<div
											role="button"
											tabIndex={0}
											onClick={(e) => {
												e.stopPropagation();
												const order: Array<"private" | "friends" | "public"> = [
													"private",
													"friends",
													"public",
												];
												const currentIndex = order.indexOf(bookmark.visibility);
												const next =
													order[(currentIndex + 1) % order.length] ?? "private";
												onChangeVisibility(next);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													e.stopPropagation();
													const order: Array<"private" | "friends" | "public"> =
														["private", "friends", "public"];
													const currentIndex = order.indexOf(
														bookmark.visibility,
													);
													const next =
														order[(currentIndex + 1) % order.length] ??
														"private";
													onChangeVisibility(next);
												}
											}}
											className={cn(
												"flex shrink-0 cursor-pointer items-center justify-center rounded-full p-2 text-muted-foreground",
												"[@media(hover:hover)]:hover:bg-muted",
											)}
											title={`Visibility: ${bookmark.visibility}`}
											aria-label={`Change visibility (currently ${bookmark.visibility})`}
										>
											{bookmark.visibility === "public" ? (
												<IconGlobe2 size={16} />
											) : bookmark.visibility === "friends" ? (
												<IconUsersFilled size={16} />
											) : (
												<IconLockFilled size={16} />
											)}
										</div>
									)}

									{/* favorite star — hidden in read-only mode; div to avoid nesting button */}
									{!readOnly && (
										// biome-ignore lint/a11y/useSemanticElements: row is interactive; nesting <button> invalid
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
												"flex shrink-0 cursor-pointer items-center justify-center rounded-full p-2 transition-colors duration-100",
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
											{bookmark.isFavorite ? (
												<IconStarFilled size={16} />
											) : (
												<IconStar size={16} />
											)}
										</div>
									)}

									{/* trash — hidden in read-only mode; div to avoid nesting button */}
									{!readOnly && (
										// biome-ignore lint/a11y/useSemanticElements: row is interactive; nesting <button> invalid
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
												"flex shrink-0 cursor-pointer items-center justify-center rounded-full p-2",
												"text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
												"opacity-0 transition-colors duration-100 [@media(hover:hover)]:group-hover:opacity-100",
											)}
											title="Move to trash"
											aria-label="Move bookmark to trash"
										>
											<IconTrashFilled size={16} />
										</div>
									)}
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
						<ContextMenu.Popup className={contextMenuPopupCls}>
							{readOnly && (
								<div className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground">
									<svg
										width="10"
										height="10"
										viewBox="0 0 10 10"
										fill="none"
										aria-hidden="true"
									>
										<rect
											x="1.5"
											y="4"
											width="7"
											height="5"
											rx="0.75"
											stroke="currentColor"
											strokeWidth="1.1"
										/>
										<path
											d="M3.5 4V3a2 2 0 0 1 4 0v1"
											stroke="currentColor"
											strokeWidth="1.1"
											strokeLinecap="round"
										/>
									</svg>
									Read-only collection
								</div>
							)}
							<ContextMenu.Item
								className={contextMenuItemCls}
								onClick={() =>
									window.open(bookmark.url, "_blank", "noopener,noreferrer")
								}
							>
								Open link
							</ContextMenu.Item>
							<ContextMenu.Item
								className={contextMenuItemCls}
								onClick={() =>
									navigator.clipboard
										?.writeText(bookmark.url)
										.catch(console.error)
								}
							>
								Copy URL
							</ContextMenu.Item>

							{!readOnly && (
								<ContextMenu.Item
									className={contextMenuItemCls}
									onClick={() =>
										window.dispatchEvent(
											new CustomEvent("kura:share-bookmark", {
												detail: {
													id: bookmark.id,
													title: bookmark.title ?? getDomain(bookmark.url),
												},
											}),
										)
									}
								>
									Share to friend…
								</ContextMenu.Item>
							)}

							{!readOnly && onChangeVisibility && (
								<>
									<ContextMenu.Separator className={contextMenuSeparatorCls} />
									<ContextMenu.SubmenuRoot>
										<ContextMenu.SubmenuTrigger
											className={contextMenuSubmenuTriggerCls}
										>
											<span className="flex items-center gap-2">
												{bookmark.visibility === "public" ? (
													<svg
														width="13"
														height="13"
														viewBox="0 0 13 13"
														fill="none"
														aria-hidden="true"
													>
														<circle
															cx="6.5"
															cy="6.5"
															r="5.5"
															stroke="currentColor"
															strokeWidth="1.1"
														/>
														<path
															d="M6.5 1C6.5 1 4.5 3.5 4.5 6.5s2 5.5 2 5.5M6.5 1C6.5 1 8.5 3.5 8.5 6.5S6.5 12 6.5 12M1 6.5h11"
															stroke="currentColor"
															strokeWidth="1.1"
															strokeLinecap="round"
														/>
													</svg>
												) : bookmark.visibility === "friends" ? (
													<svg
														width="13"
														height="13"
														viewBox="0 0 13 13"
														fill="none"
														aria-hidden="true"
													>
														<circle
															cx="5"
															cy="4"
															r="2"
															stroke="currentColor"
															strokeWidth="1.1"
														/>
														<path
															d="M1.5 11c0-1.933 1.567-3.5 3.5-3.5S8.5 9.067 8.5 11"
															stroke="currentColor"
															strokeWidth="1.1"
															strokeLinecap="round"
														/>
														<circle
															cx="9.5"
															cy="4.5"
															r="1.5"
															stroke="currentColor"
															strokeWidth="1.1"
														/>
														<path
															d="M11.5 10.5c0-1.38-.896-2.5-2-2.5"
															stroke="currentColor"
															strokeWidth="1.1"
															strokeLinecap="round"
														/>
													</svg>
												) : (
													<svg
														width="13"
														height="13"
														viewBox="0 0 13 13"
														fill="none"
														aria-hidden="true"
													>
														<rect
															x="2"
															y="5.5"
															width="9"
															height="6.5"
															rx="1"
															stroke="currentColor"
															strokeWidth="1.1"
														/>
														<path
															d="M4.5 5.5V4a2 2 0 0 1 4 0v1.5"
															stroke="currentColor"
															strokeWidth="1.1"
															strokeLinecap="round"
														/>
													</svg>
												)}
												<span className="capitalize">
													{bookmark.visibility}
												</span>
											</span>
											<svg
												width="10"
												height="10"
												viewBox="0 0 10 10"
												fill="none"
												className="opacity-40"
												aria-hidden="true"
											>
												<path
													d="M3.5 2L6.5 5l-3 3"
													stroke="currentColor"
													strokeWidth="1.3"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</ContextMenu.SubmenuTrigger>
										<ContextMenu.Portal>
											<ContextMenu.Positioner>
												<ContextMenu.Popup className={contextMenuSubPopupCls}>
													{(["private", "friends", "public"] as const).map(
														(v) => (
															<ContextMenu.Item
																key={v}
																className={cn(
																	contextMenuItemCls,
																	bookmark.visibility === v
																		? "text-primary"
																		: "text-foreground",
																)}
																onClick={() => onChangeVisibility(v)}
															>
																<span className="capitalize">{v}</span>
																{bookmark.visibility === v && (
																	<svg
																		width="10"
																		height="10"
																		viewBox="0 0 10 10"
																		fill="none"
																		className="ml-auto"
																		aria-hidden="true"
																	>
																		<path
																			d="M1.5 5l2.5 2.5 4.5-4.5"
																			stroke="currentColor"
																			strokeWidth="1.5"
																			strokeLinecap="round"
																			strokeLinejoin="round"
																		/>
																	</svg>
																)}
															</ContextMenu.Item>
														),
													)}
												</ContextMenu.Popup>
											</ContextMenu.Positioner>
										</ContextMenu.Portal>
									</ContextMenu.SubmenuRoot>
								</>
							)}

							{!readOnly && (
								<>
									<ContextMenu.Separator className={contextMenuSeparatorCls} />

									<ContextMenu.Item
										className={contextMenuItemCls}
										onClick={onToggleRead}
									>
										{bookmark.isRead ? "Mark as unread" : "Mark as read"}
									</ContextMenu.Item>
									<ContextMenu.Item
										className={contextMenuItemCls}
										onClick={onToggleFavorite}
									>
										{bookmark.isFavorite
											? "Remove from favorites"
											: "Add to favorites"}
									</ContextMenu.Item>
								</>
							)}

							{/* Move to collection submenu — hidden in read-only mode */}
							{!readOnly && collections.length > 0 && (
								<>
									<ContextMenu.Separator className={contextMenuSeparatorCls} />
									<ContextMenu.SubmenuRoot>
										<ContextMenu.SubmenuTrigger
											className={contextMenuSubmenuTriggerCls}
										>
											Move to collection
											<svg
												width="12"
												height="12"
												viewBox="0 0 12 12"
												fill="none"
												aria-hidden="true"
												className="shrink-0 opacity-50"
											>
												<path
													d="M4.5 2.5L8 6l-3.5 3.5"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</ContextMenu.SubmenuTrigger>
										<ContextMenu.Portal>
											<ContextMenu.Positioner>
												<ContextMenu.Popup className={contextMenuSubPopupCls}>
													{/* None / detach option */}
													<ContextMenu.Item
														className={cn(
															contextMenuItemCls,
															bookmark.collection === null
																? "text-muted-foreground"
																: "text-foreground",
														)}
														onClick={() => onMoveToCollection(null)}
													>
														<span className="size-2 shrink-0 rounded-full border border-border" />
														No collection
														{bookmark.collection === null && (
															<svg
																width="10"
																height="10"
																viewBox="0 0 10 10"
																fill="none"
																className="ml-auto shrink-0"
																aria-hidden="true"
															>
																<path
																	d="M1.5 5l2.5 2.5 4.5-4.5"
																	stroke="currentColor"
																	strokeWidth="1.5"
																	strokeLinecap="round"
																	strokeLinejoin="round"
																/>
															</svg>
														)}
													</ContextMenu.Item>
													<ContextMenu.Separator
														className={contextMenuSeparatorCls}
													/>
													{collections.map((c) => (
														<ContextMenu.Item
															key={c.id}
															className={cn(
																contextMenuItemCls,
																bookmark.collection?.id === c.id
																	? "text-muted-foreground"
																	: "text-foreground",
															)}
															onClick={() => onMoveToCollection(c.id)}
														>
															<span className="size-2 shrink-0 rounded-full bg-primary/60" />
															{c.name}
															{bookmark.collection?.id === c.id && (
																<svg
																	width="10"
																	height="10"
																	viewBox="0 0 10 10"
																	fill="none"
																	className="ml-auto shrink-0"
																	aria-hidden="true"
																>
																	<path
																		d="M1.5 5l2.5 2.5 4.5-4.5"
																		stroke="currentColor"
																		strokeWidth="1.5"
																		strokeLinecap="round"
																		strokeLinejoin="round"
																	/>
																</svg>
															)}
														</ContextMenu.Item>
													))}
												</ContextMenu.Popup>
											</ContextMenu.Positioner>
										</ContextMenu.Portal>
									</ContextMenu.SubmenuRoot>
								</>
							)}

							{/* Tags submenu — hidden in read-only mode or when tag callbacks are unavailable.
						    Shown even when allTags is empty so the user can create their first tag. */}
							{!readOnly && allTags !== undefined && onChangeTags && (
								<>
									<ContextMenu.Separator className={contextMenuSeparatorCls} />
									<ContextMenu.SubmenuRoot>
										<ContextMenu.SubmenuTrigger
											className={contextMenuSubmenuTriggerCls}
										>
											<span className="flex items-center gap-2">
												{/* Simple tag icon made from a rotated rectangle so we avoid pulling extra icon sets. */}
												<IconTagFilled size={16} />
												<span>Tags</span>
											</span>
											<svg
												width="10"
												height="10"
												viewBox="0 0 10 10"
												fill="none"
												className="opacity-40"
												aria-hidden="true"
											>
												<path
													d="M3.5 2L6.5 5l-3 3"
													stroke="currentColor"
													strokeWidth="1.3"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</ContextMenu.SubmenuTrigger>
										<ContextMenu.Portal>
											<ContextMenu.Positioner>
												<ContextMenu.Popup className={contextMenuSubPopupCls}>
													{allTags.map((t) => {
														const checked = assignedTagIds.includes(t.id);
														return (
															<ContextMenu.Root key={t.id}>
																{/* Right-click opens nested "Edit tag" menu */}
																<ContextMenu.Trigger
																	render={(triggerProps) => (
																		<div {...triggerProps} className="contents">
																			<ContextMenu.CheckboxItem
																				checked={checked}
																				className={cn(
																					contextMenuItemCls,
																					checked
																						? "bg-primary/10 text-primary"
																						: "text-foreground",
																				)}
																				onCheckedChange={(nextChecked) => {
																					const nextIds = new Set(
																						assignedTagIds,
																					);
																					if (nextChecked) nextIds.add(t.id);
																					else nextIds.delete(t.id);
																					onChangeTags(Array.from(nextIds));
																				}}
																			>
																				{/* Color dot — shown when tag has a color */}
																				{t.color ? (
																					<span
																						className="size-2.5 shrink-0 rounded-full border border-border/50"
																						style={{ backgroundColor: t.color }}
																						aria-hidden="true"
																					/>
																				) : (
																					<span
																						className="size-2.5 shrink-0 rounded-full border border-border bg-muted"
																						aria-hidden="true"
																					/>
																				)}
																				<span className="truncate">
																					{t.name}
																				</span>
																				{checked && (
																					<svg
																						width="10"
																						height="10"
																						viewBox="0 0 10 10"
																						fill="none"
																						className="ml-auto shrink-0 text-primary"
																						aria-hidden="true"
																					>
																						<path
																							d="M1.5 5l2.5 2.5 4.5-4.5"
																							stroke="currentColor"
																							strokeWidth="1.5"
																							strokeLinecap="round"
																							strokeLinejoin="round"
																						/>
																					</svg>
																				)}
																			</ContextMenu.CheckboxItem>
																		</div>
																	)}
																/>
																<ContextMenu.Portal>
																	<ContextMenu.Backdrop className="fixed inset-0 bg-transparent" />
																	<ContextMenu.Positioner>
																		<ContextMenu.Popup
																			className={contextMenuSubPopupCls}
																		>
																			<ContextMenu.Item
																				className={contextMenuItemCls}
																				onClick={(e) => {
																					e.preventDefault();
																					e.stopPropagation();
																					setEditingTag(t);
																				}}
																			>
																				<svg
																					width="13"
																					height="13"
																					viewBox="0 0 13 13"
																					fill="none"
																					aria-hidden="true"
																				>
																					<path
																						d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z"
																						stroke="currentColor"
																						strokeWidth="1.1"
																						strokeLinejoin="round"
																					/>
																				</svg>
																				Edit tag…
																			</ContextMenu.Item>
																		</ContextMenu.Popup>
																	</ContextMenu.Positioner>
																</ContextMenu.Portal>
															</ContextMenu.Root>
														);
													})}
													{onCreateTag && (
														<>
															<ContextMenu.Separator
																className={contextMenuSeparatorCls}
															/>
															<ContextMenu.Item
																className={contextMenuItemCls}
																onClick={(e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	setShowCreateTagDialog(true);
																}}
															>
																Create tag…
															</ContextMenu.Item>
														</>
													)}
												</ContextMenu.Popup>
											</ContextMenu.Positioner>
										</ContextMenu.Portal>
									</ContextMenu.SubmenuRoot>
								</>
							)}

							{!readOnly && onEdit && (
								<>
									<ContextMenu.Separator className={contextMenuSeparatorCls} />
									<ContextMenu.Item
										className={contextMenuItemCls}
										onClick={onEdit}
									>
										{/* pencil icon */}
										<svg
											width="13"
											height="13"
											viewBox="0 0 13 13"
											fill="none"
											aria-hidden="true"
										>
											<path
												d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z"
												stroke="currentColor"
												strokeWidth="1.1"
												strokeLinejoin="round"
											/>
										</svg>
										Edit
									</ContextMenu.Item>
								</>
							)}

							{!readOnly && (
								<>
									<ContextMenu.Separator className={contextMenuSeparatorCls} />
									<ContextMenu.Item
										className={contextMenuDestructiveItemCls}
										onClick={onTrash}
									>
										Move to trash
									</ContextMenu.Item>
								</>
							)}
						</ContextMenu.Popup>
					</ContextMenu.Positioner>
				</ContextMenu.Portal>
			</ContextMenu.Root>

			{/* Create tag dialog — opens from Tags submenu */}
			<AnimatePresence>
				{showCreateTagDialog && onCreateTag && onChangeTags && (
					<CreateTagDialog
						onClose={() => setShowCreateTagDialog(false)}
						onCreateAndAttach={handleCreateAndAttach}
					/>
				)}
			</AnimatePresence>

			{/* Edit tag dialog — opens from right-click on tag in Tags submenu */}
			<AnimatePresence>
				{editingTag && onEditTag && (
					<EditTagDialog
						tag={editingTag}
						onClose={() => setEditingTag(null)}
						onSave={async (patch) => {
							await onEditTag(editingTag, patch);
						}}
					/>
				)}
			</AnimatePresence>
		</>
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
		triggerBookmarkRefetch,
		searchQuery,
		followedCollectionIds,
		groupByDateAdded,
	} = useCollection();
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [collections, setCollections] = useState<Collection[]>([]);
	// Tag catalog is shared across all bookmarks for the current user and powers
	// the Tags submenu; we keep it here so each row can consume it.
	const [allTags, setAllTags] = useState<Tag[]>([]);
	const [loading, setLoading] = useState(true);
	// the bookmark currently open in the edit sheet, or null when closed
	const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
	const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
	const isInitialLoad = useRef(true);
	// keep a stable ref so the effect doesn't need followedCollectionIds in its dep array
	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<{ id: string; title: string }>)
				.detail;
			setShareTarget({ type: "bookmark", id: detail.id, title: detail.title });
		};
		window.addEventListener("kura:share-bookmark", handler as EventListener);
		return () => {
			window.removeEventListener(
				"kura:share-bookmark",
				handler as EventListener,
			);
		};
	}, []);
	const followedCollectionIdsRef = useRef(followedCollectionIds);
	followedCollectionIdsRef.current = followedCollectionIds;
	const shouldReduceMotion = useReducedMotion();

	useEffect(() => {
		const isFollowed =
			!!activeCollectionId &&
			followedCollectionIdsRef.current.has(activeCollectionId);

		const fetchBookmarks = async (showLoading = false) => {
			if (showLoading) setLoading(true);

			// if viewing a followed (not owned) collection, fetch from the followed endpoint
			if (isFollowed) {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/users/collections/${activeCollectionId}/bookmarks`,
					{ credentials: "include" },
				);
				if (!res.ok) {
					setLoading(false);
					return;
				}
				const data = await res.json();
				// Followed collections do not currently expose tags; we still cast
				// to Bookmark for convenience and treat tags as absent in the UI.
				if (Array.isArray(data)) setBookmarks(data as Bookmark[]);
				setLoading(false);
				isInitialLoad.current = false;
				return;
			}

			const [{ data, error }, sharedRes] = await Promise.all([
				api.bookmarks.get(),
				fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/shared-with-me`, {
					credentials: "include",
				}).catch(() => null),
			]);

			if (error) {
				console.error(error);
				setLoading(false);
				return;
			}

			let inboxBookmarks: Bookmark[] = [];
			if (data && Array.isArray(data)) {
				// Normalize the joined bookmarkTag relation into a flat tags array
				// so the rest of the component tree can treat tags as simple data.
				type RawBookmark = Omit<Bookmark, "tags" | "sharedFrom"> & {
					tags?: { tag: Tag | null }[];
				};

				inboxBookmarks = (data as RawBookmark[]).map((raw) => {
					const joined = Array.isArray(raw.tags) ? raw.tags : [];
					const flatTags = joined
						.map((entry) => entry.tag)
						.filter((t): t is Tag => Boolean(t));

					return {
						...raw,
						tags: flatTags,
					} satisfies Bookmark;
				});
			}

			// Shared-with-me bookmarks: these are owned by friends but visible to the
			// current user. We project them into the Bookmark shape and mark them
			// as shared so they render read-only and can be distinguished in the UI.
			let sharedBookmarks: Bookmark[] = [];
			if (sharedRes?.ok) {
				type SharedRow = {
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
				};

				const rows = (await sharedRes.json().catch(() => [])) as SharedRow[];
				if (Array.isArray(rows)) {
					sharedBookmarks = rows
						.filter(
							(
								row,
							): row is SharedRow & {
								bookmark: NonNullable<SharedRow["bookmark"]>;
							} => Boolean(row.bookmark),
						)
						.map((row) => {
							const b = row.bookmark;
							const coll = row.collection;
							const createdAt = row.createdAt ?? new Date().toISOString();

							return {
								id: b.id,
								url: b.url,
								title: b.title,
								description: null,
								image: null,
								favicon: b.favicon,
								siteName: b.siteName,
								isRead: false,
								isFavorite: false,
								isTrashed: false,
								visibility: "friends",
								createdAt,
								collection: coll
									? { id: coll.id, name: coll.name, color: coll.color }
									: null,
								sharedFrom: row.sender
									? {
											name: row.sender.name,
											username: row.sender.username,
										}
									: null,
								tags: [],
							} satisfies Bookmark;
						});
				}
			}

			setBookmarks([...inboxBookmarks, ...sharedBookmarks]);
			setLoading(false);
			isInitialLoad.current = false;
		};

		fetchBookmarks(isInitialLoad.current);

		// poll every 5 s when viewing a followed collection so edits by the owner appear quickly
		if (!isFollowed) return;
		const intervalId = setInterval(() => fetchBookmarks(false), 5_000);
		return () => clearInterval(intervalId);
	}, [activeCollectionId]);

	// fetch collections for the move submenu
	useEffect(() => {
		api.collections.get().then(({ data }) => {
			if (data && Array.isArray(data))
				setCollections(data.map((c) => ({ id: c.id, name: c.name })));
		});
	}, []);

	// When the user triggers "Re-enrich bookmarks" from Settings, start polling
	// every 10 s for up to 2 minutes so enriched metadata shows up automatically.
	useEffect(() => {
		const handleEnrichStarted = () => {
			// Immediate refetch to catch any already-completed tasks.
			triggerBookmarkRefetch();

			let ticks = 0;
			const id = setInterval(() => {
				ticks++;
				triggerBookmarkRefetch();
				// Stop after ~2 minutes (12 × 10 s).
				if (ticks >= 12) clearInterval(id);
			}, 10_000);

			return () => clearInterval(id);
		};

		window.addEventListener("kura:enrich-started", handleEnrichStarted);
		return () =>
			window.removeEventListener("kura:enrich-started", handleEnrichStarted);
	}, [triggerBookmarkRefetch]);

	// fetch tag catalog for the Tags submenu
	useEffect(() => {
		// We keep this call simple and fire it once on mount for the dashboard;
		// tags are scoped per user so there is no need to refetch aggressively.
		api.tags
			.get()
			.then(({ data, error }) => {
				if (error) {
					console.error("Failed to load tags:", error);
					return;
				}
				if (data && Array.isArray(data)) {
					const tags = (data as Tag[])
						.slice()
						.sort((a, b) => a.name.localeCompare(b.name));
					setAllTags(tags);
				}
			})
			.catch((err) => {
				console.error("Unexpected error while loading tags:", err);
			});
	}, []);

	useEffect(() => {
		isInitialLoad.current = true;
	}, []);

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
			// Re-sync inbox on failure so the item reappears.
			triggerBookmarkRefetch();
			return;
		}
		// Notify TrashList to silently refetch so the newly trashed item appears
		// immediately when the user switches to the trash view.
		triggerBookmarkRefetch();
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
			updateBookmark(bookmark.id, { isRead: bookmark.isRead });
			return;
		}

		// Badge progress can advance when a bookmark is marked read or unread, so
		// request an immediate unlock refresh after the server accepts the change.
		window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
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
			updateBookmark(bookmark.id, { isFavorite: bookmark.isFavorite });
			return;
		}

		// Favorite milestones unlock from this path, so re-check badge unlocks as
		// soon as the toggle succeeds instead of waiting for polling.
		window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
	};

	// ─── visibility ────────────────────────────────────────────────────────────
	const handleVisibilityChange = async (
		bookmark: Bookmark,
		visibility: "private" | "friends" | "public",
	) => {
		if (bookmark.visibility === visibility) return;

		const previous = bookmark.visibility;
		updateBookmark(bookmark.id, { visibility });

		const { error } = await api
			.bookmarks({ id: bookmark.id })
			.visibility.patch({ visibility });

		if (error) {
			console.error("Failed to update bookmark visibility:", error);
			updateBookmark(bookmark.id, { visibility: previous });
		}
	};

	// ─── move to collection ───────────────────────────────────────────────────
	const handleMoveToCollection = async (
		bookmark: Bookmark,
		collectionId: string | null,
	) => {
		const prevCollection = bookmark.collection;
		const nextCollection = collectionId
			? (collections.find((c) => c.id === collectionId) ?? null)
			: null;
		updateBookmark(bookmark.id, {
			collection: nextCollection ? { ...nextCollection, color: null } : null,
		});
		const { error } = await api
			.bookmarks({ id: bookmark.id })
			.move.patch({ collectionId });
		if (error) {
			console.error("Failed to move bookmark:", error);
			updateBookmark(bookmark.id, { collection: prevCollection });
		}
	};

	// ─── tags (assign / unassign) ─────────────────────────────────────────────
	const handleTagsChange = async (bookmark: Bookmark, tagIds: string[]) => {
		// When tag data is missing (e.g. followed collections), we bail out early
		// instead of attempting to patch with an unknown state.
		if (!bookmark.tags) return;

		const previousTags = bookmark.tags;
		const nextTags = allTags.filter((t) => tagIds.includes(t.id));

		updateBookmark(bookmark.id, { tags: nextTags });

		const { error } = await api
			.bookmarks({ id: bookmark.id })
			.tags.patch({ tagIds });

		if (error) {
			console.error("Failed to update bookmark tags:", error);
			updateBookmark(bookmark.id, { tags: previousTags });
		}
	};

	// ─── tags (create) ────────────────────────────────────────────────────────
	const handleCreateTag = async (
		name: string,
		color?: string | null,
	): Promise<Tag | null> => {
		const trimmed = name.trim();
		if (!trimmed) return null;

		// Reuse an existing tag if the name already exists (case-insensitive) so
		// the catalog does not silently drift with near-duplicates.
		const existing = allTags.find(
			(t) => t.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
		);
		if (existing) return existing;

		const { data, error } = await api.tags.post({
			name: trimmed,
			color: color ?? null,
		});

		if (error) {
			console.error("Failed to create tag:", error);
			return null;
		}

		if (!data || typeof data !== "object" || !("id" in data)) {
			return null;
		}

		const created = data as Tag;
		setAllTags((prev) =>
			[...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
		);

		return created;
	};

	// ─── edit (title + description) ──────────────────────────────────────────
	const handleEditSave = (
		bookmarkId: string,
		patch: { title: string | null; description: string | null },
	) => {
		updateBookmark(bookmarkId, patch);
	};

	// ─── edit tag (name + color) ──────────────────────────────────────────────
	const handleEditTag = async (
		tag: Tag,
		patch: { name: string; color: string | null },
	) => {
		const { error } = await api.tags({ id: tag.id }).patch(patch);
		if (error) throw new Error("Failed to update tag");

		const updated: Tag = { ...tag, ...patch };
		setAllTags((prev) =>
			prev
				.map((t) => (t.id === tag.id ? updated : t))
				.sort((a, b) => a.name.localeCompare(b.name)),
		);
		// Update tag in any bookmark that has it
		setBookmarks((prev) =>
			prev.map((b) => {
				if (!b.tags) return b;
				const hasTag = b.tags.some((t) => t.id === tag.id);
				if (!hasTag) return b;
				return {
					...b,
					tags: b.tags.map((t) => (t.id === tag.id ? updated : t)),
				};
			}),
		);
	};

	const isFollowedCollection =
		activeCollectionId !== null &&
		followedCollectionIds.has(activeCollectionId);
	const isSharedBookmark = (b: Bookmark) => Boolean(b.sharedFrom);
	const filtered = bookmarks
		// for followed collections the server already scopes to that collection
		.filter(
			(b) =>
				isFollowedCollection ||
				isSharedBookmark(b) ||
				activeCollectionId === null ||
				b.collection?.id === activeCollectionId,
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

	const groups: BookmarkGroup[] = groupByDateAdded
		? groupByDate(filtered)
		: filtered.length > 0
			? [{ label: "All bookmarks", bookmarks: filtered }]
			: [];
	let rowIndex = 0;

	return (
		<>
			{/* edit bookmark sheet — rendered at the root so it overlays everything */}
			<AnimatePresence>
				{editingBookmark && (
					<EditBookmarkSheet
						bookmark={editingBookmark}
						onClose={() => setEditingBookmark(null)}
						onSave={(patch) => handleEditSave(editingBookmark.id, patch)}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{shareTarget && (
					<ShareToFriendDialog
						target={shareTarget}
						onClose={() => setShareTarget(null)}
					/>
				)}
			</AnimatePresence>

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
										<AnimatePresence initial={false}>
											{groups.map((group, groupIndex) => (
												<motion.div
													key={group.label}
													layout
													className="flex flex-col"
													transition={
														shouldReduceMotion
															? { duration: 0 }
															: {
																	duration: 0.18,
																	ease: [0.215, 0.61, 0.355, 1],
																}
													}
												>
													{groupByDateAdded && (
														<motion.div
															layout
															initial={{ opacity: 0, y: -4 }}
															animate={{ opacity: 1, y: 0 }}
															exit={{ opacity: 0, y: -4 }}
															transition={
																shouldReduceMotion
																	? { duration: 0 }
																	: {
																			duration: 0.18,
																			ease: [0.215, 0.61, 0.355, 1],
																		}
															}
															className={cn(
																"px-3.5 pb-2.5 font-medium text-muted-foreground/70 text-xs capitalize",
																groupIndex === 0 ? "pt-2" : "pt-10",
															)}
														>
															{group.label}
														</motion.div>
													)}
													{group.bookmarks.map((b) => {
														const _index = rowIndex++;
														const rowKey = b.sharedFrom
															? `shared-${b.id}`
															: `own-${b.id}`;
														return (
															<motion.div
																key={rowKey}
																layout
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
																				duration: 0.18,
																				ease: [0.215, 0.61, 0.355, 1],
																			}
																}
															>
																<BookmarkRow
																	bookmark={b}
																	collections={collections}
																	onTrash={() => handleTrash(b.id)}
																	onToggleRead={() => handleToggleRead(b)}
																	onToggleFavorite={() =>
																		handleToggleFavorite(b)
																	}
																	onMoveToCollection={(collectionId) =>
																		handleMoveToCollection(b, collectionId)
																	}
																	onChangeVisibility={(visibility) =>
																		handleVisibilityChange(b, visibility)
																	}
																	allTags={allTags}
																	onChangeTags={(tagIds) =>
																		handleTagsChange(b, tagIds)
																	}
																	onCreateTag={handleCreateTag}
																	onEditTag={handleEditTag}
																	onEdit={() => setEditingBookmark(b)}
																	readOnly={
																		isFollowedCollection ||
																		Boolean(b.sharedFrom)
																	}
																/>
															</motion.div>
														);
													})}
												</motion.div>
											))}
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
