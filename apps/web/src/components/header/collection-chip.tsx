"use client";

import { cn } from "@Kura/ui/lib/utils";
import { ContextMenu } from "@base-ui/react/context-menu";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
	contextMenuDestructiveItemCls,
	contextMenuItemCls,
	contextMenuPopupCls,
	contextMenuSeparatorCls,
	contextMenuSubmenuTriggerCls,
	contextMenuSubPopupCls,
} from "@/lib/context-menu-styles";

export interface CollectionChipAnimationConfig {
	wrapperMaxWidthExpanded: string;
	initialScale: number;
	finalScale: number;
	wrapperTransition: Record<string, unknown>;
	chipTransition: Record<string, unknown>;
	chipAppearDelayMs: number;
}

export interface CollectionChipProps {
	name: string;
	isSelected: boolean;
	isNew: boolean;
	newChipStage: number;
	isInitialLoad?: boolean;
	initialLoadDelayMs?: number;
	onClick: () => void;
	/** "trash" = soft-delete collection + bookmarks (restorable from trash)
	 *  "keep-bookmarks" = hard-delete collection only, bookmarks stay detached */
	onDelete?: (mode: "trash" | "keep-bookmarks") => void;
	visibility?: "private" | "friends" | "public";
	onVisibilityChange?: (visibility: "private" | "friends" | "public") => void;
	/** called when the user renames the collection; parent should persist to the server */
	onRename?: (name: string) => void;
	/** the collection's current color (hex string or null) */
	color?: string | null;
	/** called when the user picks a new color or null to remove it; parent should persist to the server */
	onColorChange?: (color: string | null) => void;
	/** set when this chip is a followed (read-only) collection owned by someone else */
	owner?: {
		id: string;
		name: string;
		username: string | null;
		image: string | null;
	} | null;
	/** called for followed (read-only) collections when the user chooses Unfollow */
	onUnfollowFollowed?: () => void;
	/** called for followed collections when the user chooses to view the creator's page */
	onViewCreator?: () => void;
	animation: CollectionChipAnimationConfig;
	className?: string;
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteCollectionDialog({
	name,
	onTrashWithBookmarks,
	onDeleteKeepBookmarks,
	onCancel,
}: {
	name: string;
	onTrashWithBookmarks: () => void;
	onDeleteKeepBookmarks: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<motion.div
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onCancel}
			/>

			<motion.div
				className="relative z-10 mx-4 flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-popover p-5 shadow-xl"
				initial={{ opacity: 0, scale: 0.95, y: 8 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 8 }}
				transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
			>
				{/* header */}
				<div className="flex items-center gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M6.5 1.5h3a.5.5 0 0 1 .5.5V3H6v-.5a.5.5 0 0 1 .5-.5zM5 3V2A1.5 1.5 0 0 1 6.5.5h3A1.5 1.5 0 0 1 11 2v1h3a.5.5 0 0 1 0 1h-.535l-.82 8.603A1.5 1.5 0 0 1 11.15 14H4.85a1.5 1.5 0 0 1-1.495-1.397L2.535 4H2a.5.5 0 0 1 0-1h3zm1 2a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 6 5zm4 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 10 5z"
								fill="currentColor"
								className="text-destructive"
							/>
						</svg>
					</span>
					<div>
						<p className="font-medium text-foreground text-sm">
							Delete "{name}"
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							What should happen to the bookmarks inside?
						</p>
					</div>
				</div>

				{/* options */}
				<div className="flex flex-col gap-2">
					{/* option 1: keep bookmarks, hard delete collection */}
					<button
						type="button"
						onClick={onDeleteKeepBookmarks}
						className="flex flex-col gap-0.5 rounded-lg border border-border px-3.5 py-3 text-left transition-colors hover:bg-muted"
					>
						<span className="font-medium text-foreground text-sm">
							Keep bookmarks
						</span>
						<span className="text-muted-foreground text-xs">
							Bookmarks stay in your library without a collection
						</span>
					</button>

					{/* option 2: trash collection + bookmarks together */}
					<button
						type="button"
						onClick={onTrashWithBookmarks}
						className="flex flex-col gap-0.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-left transition-colors hover:bg-destructive/10"
					>
						<span className="font-medium text-destructive text-sm">
							Move to trash with bookmarks
						</span>
						<span className="text-muted-foreground text-xs">
							Collection and its bookmarks go to trash — restore them together
							anytime
						</span>
					</button>
				</div>

				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-3 py-2 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted"
				>
					Cancel
				</button>
			</motion.div>
		</div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CollectionChip({
	name,
	isSelected,
	isNew,
	newChipStage,
	isInitialLoad = false,
	initialLoadDelayMs = 0,
	onClick,
	onDelete,
	visibility = "private",
	onVisibilityChange,
	onRename,
	color,
	onColorChange,
	owner,
	onUnfollowFollowed,
	onViewCreator,
	animation,
	className,
}: CollectionChipProps) {
	const {
		wrapperMaxWidthExpanded,
		initialScale,
		finalScale,
		wrapperTransition,
		chipTransition,
		chipAppearDelayMs,
	} = animation;

	const [dialogOpen, setDialogOpen] = useState(false);
	// inline rename state
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState(name);
	const renameInputRef = useRef<HTMLInputElement>(null);
	// hidden color input ref for native color picker
	const colorInputRef = useRef<HTMLInputElement>(null);

	const useInitialLoadEntrance = isInitialLoad && !isNew;
	const wrapperDelay = useInitialLoadEntrance ? initialLoadDelayMs / 1000 : 0;
	const chipDelay = useInitialLoadEntrance
		? (initialLoadDelayMs + chipAppearDelayMs) / 1000
		: 0;

	// focus the rename input when rename mode activates
	useEffect(() => {
		if (isRenaming) {
			setRenameValue(name);
			const t = setTimeout(() => renameInputRef.current?.focus(), 50);
			return () => clearTimeout(t);
		}
	}, [isRenaming, name]);

	const commitRename = () => {
		const trimmed = renameValue.trim();
		if (trimmed && trimmed !== name) {
			onRename?.(trimmed);
		}
		setIsRenaming(false);
	};

	const cancelRename = () => {
		setRenameValue(name);
		setIsRenaming(false);
	};

	// shared chip button appearance animation values
	const chipOpacity =
		useInitialLoadEntrance || !isNew || newChipStage >= 2 ? 1 : 0;
	const chipScale =
		useInitialLoadEntrance || !isNew || newChipStage >= 2
			? finalScale
			: initialScale;
	const chipTransitionProps = useInitialLoadEntrance
		? { ...chipTransition, delay: chipDelay }
		: {
				...chipTransition,
				delay: isNew && newChipStage === 1 ? chipAppearDelayMs / 1000 : 0,
			};

	return (
		<>
			<AnimatePresence>
				{dialogOpen && (
					<DeleteCollectionDialog
						name={name}
						onDeleteKeepBookmarks={() => {
							setDialogOpen(false);
							onDelete?.("keep-bookmarks");
						}}
						onTrashWithBookmarks={() => {
							setDialogOpen(false);
							onDelete?.("trash");
						}}
						onCancel={() => setDialogOpen(false)}
					/>
				)}
			</AnimatePresence>

			{/* hidden native color input — triggered programmatically.
		    key forces a remount when the color changes so defaultValue stays accurate. */}
			{!owner && onColorChange && (
				<input
					key={color ?? "none"}
					ref={colorInputRef}
					type="color"
					defaultValue={color ?? "#6366f1"}
					className="sr-only"
					aria-hidden="true"
					tabIndex={-1}
					onChange={(e) => onColorChange(e.target.value)}
				/>
			)}

			<ContextMenu.Root>
				{/* The motion.div is the ContextMenu.Trigger — exactly the original structure.
			    The inner content switches between the chip button and the rename input. */}
				<ContextMenu.Trigger
					render={
						<motion.div
							className={cn("flex items-center overflow-hidden", className)}
							initial={useInitialLoadEntrance ? { maxWidth: 0 } : false}
							animate={{
								maxWidth: useInitialLoadEntrance
									? wrapperMaxWidthExpanded
									: isNew
										? newChipStage >= 1
											? wrapperMaxWidthExpanded
											: 0
										: "50rem",
							}}
							transition={
								useInitialLoadEntrance
									? { ...wrapperTransition, delay: wrapperDelay }
									: wrapperTransition
							}
						/>
					}
				>
					{isRenaming ? (
						// plain input that swaps in for the button; no extra animation so the
						// wrapper maxWidth stays steady and no chip-hiding side-effects occur
						<input
							ref={renameInputRef}
							type="text"
							value={renameValue}
							onChange={(e) => setRenameValue(e.target.value)}
							onBlur={commitRename}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									commitRename();
								} else if (e.key === "Escape") {
									e.preventDefault();
									cancelRename();
								}
							}}
							spellCheck={false}
							autoComplete="off"
							className={cn(
								"w-[9rem] min-w-0 shrink-0 whitespace-nowrap rounded-full border-none bg-foreground px-2.5 py-1 font-medium text-background text-sm outline-none",
								"focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
							)}
						/>
					) : (
						<motion.button
							type="button"
							className={cn(
								"relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-medium text-sm outline-none",
								"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								"active:scale-[0.97]",
								"[@media(hover:hover)]:hover:opacity-100",
								isSelected
									? "bg-foreground text-background"
									: "text-foreground",
							)}
							initial={
								useInitialLoadEntrance
									? { opacity: 0, scale: initialScale }
									: false
							}
							animate={{ opacity: chipOpacity, scale: chipScale }}
							transition={chipTransitionProps}
							onClick={onClick}
						>
							{/* color dot — shown when collection has a custom color */}
							{color && (
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: color }}
									aria-hidden="true"
								/>
							)}
							{name}
							{owner && (
								<span
									className="ml-0.5 flex size-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-background"
									title={`By ${owner.name}`}
								>
									{owner.image ? (
										// biome-ignore lint/performance/noImgElement: tiny avatar (14px), external URL; next/image not beneficial
										<img
											src={owner.image}
											alt={owner.name}
											className="size-full object-cover"
										/>
									) : (
										<span className="font-bold text-[7px] leading-none">
											{owner.name.charAt(0).toUpperCase()}
										</span>
									)}
								</span>
							)}
						</motion.button>
					)}
				</ContextMenu.Trigger>

				<ContextMenu.Portal>
					<ContextMenu.Positioner>
						<ContextMenu.Popup className={contextMenuPopupCls}>
							{/* rename + color — own collections only */}
							{!owner && onRename && (
								<ContextMenu.Item
									className={contextMenuItemCls}
									onClick={() => setIsRenaming(true)}
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
									Rename
								</ContextMenu.Item>
							)}

							{!owner && onColorChange && (
								<ContextMenu.Item
									className={contextMenuItemCls}
									onClick={() => colorInputRef.current?.click()}
								>
									{/* color swatch */}
									<span
										className="size-3.5 rounded-full border border-border"
										style={{ backgroundColor: color ?? "hsl(var(--muted))" }}
										aria-hidden="true"
									/>
									Change color
								</ContextMenu.Item>
							)}

							{/* remove color — only when a color is set */}
							{!owner && onColorChange && color && (
								<ContextMenu.Item
									className={contextMenuItemCls}
									onClick={() => onColorChange(null)}
								>
									{/* slash-circle icon */}
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
											d="M2.5 10.5l8-8"
											stroke="currentColor"
											strokeWidth="1.1"
											strokeLinecap="round"
										/>
									</svg>
									Remove color
								</ContextMenu.Item>
							)}

							{/* separator before visibility / delete */}
							{!owner &&
								(onRename || onColorChange) &&
								(onVisibilityChange || onDelete) && (
									<ContextMenu.Separator className={contextMenuSeparatorCls} />
								)}

							{/* followed collections: view creator + unfollow actions */}
							{owner && (onViewCreator || onUnfollowFollowed) && (
								<>
									<ContextMenu.Item
										className={contextMenuItemCls}
										disabled={!onViewCreator}
										onClick={() => {
											// For followed collections, allow quickly opening the creator's profile
											onViewCreator?.();
										}}
									>
										{/* person icon */}
										<svg
											width="13"
											height="13"
											viewBox="0 0 13 13"
											fill="none"
											aria-hidden="true"
										>
											<circle
												cx="6.5"
												cy="4.25"
												r="2.25"
												stroke="currentColor"
												strokeWidth="1.1"
											/>
											<path
												d="M2.5 11c0-2.209 1.79-4 4-4s4 1.791 4 4"
												stroke="currentColor"
												strokeWidth="1.1"
												strokeLinecap="round"
											/>
										</svg>
										View creator profile
									</ContextMenu.Item>

									{onUnfollowFollowed && (
										<ContextMenu.Item
											className={contextMenuDestructiveItemCls}
											onClick={() => {
												// Unfollow the collection from the dashboard header
												onUnfollowFollowed();
											}}
										>
											{/* broken-link icon */}
											<svg
												width="13"
												height="13"
												viewBox="0 0 13 13"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M4.75 2.5l-1-1M9.25 7l-1-1M3.5 6.5l-1.75 1.75a1.75 1.75 0 0 0 2.475 2.475L6 8.7M7 4.5l1.775-1.775a1.75 1.75 0 0 1 2.475 2.475L9.5 7"
													stroke="currentColor"
													strokeWidth="1.1"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
											Unfollow collection
										</ContextMenu.Item>
									)}
								</>
							)}

							{/* visibility submenu */}
							{!owner && onVisibilityChange && (
								<>
									<ContextMenu.SubmenuRoot>
										<ContextMenu.SubmenuTrigger
											className={contextMenuSubmenuTriggerCls}
										>
											<span className="flex items-center gap-2">
												{visibility === "public" ? (
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
												) : visibility === "friends" ? (
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
												<span className="capitalize">{visibility}</span>
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
																	visibility === v
																		? "text-primary"
																		: "text-foreground",
																)}
																onClick={() => onVisibilityChange(v)}
															>
																<span className="capitalize">{v}</span>
																{visibility === v && (
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
									<ContextMenu.Separator className={contextMenuSeparatorCls} />
								</>
							)}

							{!owner && (
								<ContextMenu.Item
									className={contextMenuDestructiveItemCls}
									onClick={() => setDialogOpen(true)}
								>
									<svg
										width="13"
										height="13"
										viewBox="0 0 13 13"
										fill="none"
										aria-hidden="true"
									>
										<path
											d="M5.5 1h2a.5.5 0 0 1 .5.5V2H5v-.5a.5.5 0 0 1 .5-.5zM4 2v-.5A1.5 1.5 0 0 1 5.5.5h2A1.5 1.5 0 0 1 9 2v.5h2.5a.5.5 0 0 1 0 1H11v7a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 2 10.5v-7h-.5a.5.5 0 0 1 0-1H4zM3 3.5v7a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-7H3z"
											fill="currentColor"
										/>
									</svg>
									Delete collection
								</ContextMenu.Item>
							)}
						</ContextMenu.Popup>
					</ContextMenu.Positioner>
				</ContextMenu.Portal>
			</ContextMenu.Root>
		</>
	);
}
