"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { cn } from "@Kura/ui/lib/utils";

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
				className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-border bg-popover p-5 shadow-xl flex flex-col gap-4"
				initial={{ opacity: 0, scale: 0.95, y: 8 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 8 }}
				transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
			>
				{/* header */}
				<div className="flex items-center gap-3">
					<span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 shrink-0">
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
						<p className="text-sm font-medium text-foreground">
							Delete "{name}"
						</p>
						<p className="text-xs text-muted-foreground mt-0.5">
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
						className="flex flex-col gap-0.5 rounded-lg border border-border px-3.5 py-3 text-left hover:bg-muted transition-colors"
					>
						<span className="text-sm font-medium text-foreground">
							Keep bookmarks
						</span>
						<span className="text-xs text-muted-foreground">
							Bookmarks stay in your library without a collection
						</span>
					</button>

					{/* option 2: trash collection + bookmarks together */}
					<button
						type="button"
						onClick={onTrashWithBookmarks}
						className="flex flex-col gap-0.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-left hover:bg-destructive/10 transition-colors"
					>
						<span className="text-sm font-medium text-destructive">
							Move to trash with bookmarks
						</span>
						<span className="text-xs text-muted-foreground">
							Collection and its bookmarks go to trash — restore them together
							anytime
						</span>
					</button>
				</div>

				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
				>
					Cancel
				</button>
			</motion.div>
		</div>
	);
}

// ─── Context menu styles ──────────────────────────────────────────────────────

const popupCls = cn(
	"min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-lg outline-none",
	"data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
	"data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
	"transition-[opacity,transform] duration-100 origin-[var(--transform-origin)]",
);

const itemCls = cn(
	"flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none",
	"data-[highlighted]:bg-muted transition-colors duration-75",
);

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

	const useInitialLoadEntrance = isInitialLoad && !isNew;
	const wrapperDelay = useInitialLoadEntrance ? initialLoadDelayMs / 1000 : 0;
	const chipDelay = useInitialLoadEntrance
		? (initialLoadDelayMs + chipAppearDelayMs) / 1000
		: 0;

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

			<ContextMenu.Root>
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
					<motion.button
						type="button"
						className={cn(
							"relative cursor-pointer flex shrink-0 items-center rounded-full text-sm font-medium outline-none select-none gap-1.5 px-2.5 py-1 text-primary whitespace-nowrap",
							"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"active:scale-[0.97]",
							"[@media(hover:hover)]:hover:opacity-100",
							isSelected ? "bg-primary text-primary-foreground" : "opacity-50",
						)}
						initial={
							useInitialLoadEntrance
								? { opacity: 0, scale: initialScale }
								: false
						}
						animate={{
							opacity:
								useInitialLoadEntrance || !isNew || newChipStage >= 2 ? 1 : 0,
							scale:
								useInitialLoadEntrance || !isNew || newChipStage >= 2
									? finalScale
									: initialScale,
						}}
						transition={
							useInitialLoadEntrance
								? { ...chipTransition, delay: chipDelay }
								: {
										...chipTransition,
										delay:
											isNew && newChipStage === 1
												? chipAppearDelayMs / 1000
												: 0,
									}
						}
						onClick={onClick}
					>
						{name}
					</motion.button>
				</ContextMenu.Trigger>

				<ContextMenu.Portal>
					<ContextMenu.Positioner>
						<ContextMenu.Popup className={popupCls}>
							<ContextMenu.Item
								className={cn(
									itemCls,
									"text-destructive data-[highlighted]:text-destructive",
								)}
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
						</ContextMenu.Popup>
					</ContextMenu.Positioner>
				</ContextMenu.Portal>
			</ContextMenu.Root>
		</>
	);
}
