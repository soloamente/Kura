"use client";

import { cn } from "@Kura/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { CollectionChipAnimationConfig } from "./collection-chip";
import { CollectionChip } from "./collection-chip";
import { usePasteBookmark } from "@/hooks/use-paste-bookmark";
import { useCollection } from "@/context/collection-context";
import { IconDeleteLeft, IconPlusSm, IconTrashFilled } from "nucleo-micro-bold";
import { IconReturnKeyFill12 } from "nucleo-ui-fill-12";
import { IconDeleteLeftFill18 } from "nucleo-ui-fill-18";

const EASE_OUT_CUBIC = [0.215, 0.61, 0.355, 1] as [
	number,
	number,
	number,
	number,
];

const CHIP_ANIMATION_TIMING = {
	wrapperStartMs: 0,
	wrapperDurationMs: 200,
	chipDelayMs: 50,
	chipDurationMs: 150,
	clearNewIdAfterMs: 400,
};

const NEW_COLLECTION_TIMING = {
	chipsExit: 0,
	chipsExitDone: 200,
	inputReveal: 240,
	iconSlide: 260,
	inputReady: 420,
} as const;

const NEW_COLLECTION_CHIPS = { exitOffsetY: 4 };

const NEW_COLLECTION_SPRING = {
	type: "spring" as const,
	stiffness: 340,
	damping: 32,
} as const;

const NEW_COLLECTION_INPUT = { maxWidthRem: 16 };
const SEARCH_INPUT = { maxWidthRem: 20 };

const WRAPPER_MAX_WIDTH_REM = 20;
const INITIAL_LOAD_STAGGER_MS = 200;
const INITIAL_LOAD_WRAPPER_DURATION_MS = 200;
const CHIPS_WRAPPER_MAX_WIDTH_REM = 80;

export interface HeaderCollection {
	id: string;
	name: string;
}

export interface HeaderProps extends React.ComponentPropsWithoutRef<"header"> {
	className?: string;
}

const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
	{ className, ...props },
	ref,
) {
	const shouldReduceMotion = useReducedMotion();
	const { trigger } = useWebHaptics({ debug: true, showSwitch: false });

	const t = CHIP_ANIMATION_TIMING;
	const wrapperTransition = shouldReduceMotion
		? { duration: 0 }
		: { duration: t.wrapperDurationMs / 1000, ease: EASE_OUT_CUBIC };
	const chipTransition = shouldReduceMotion
		? { duration: 0 }
		: { duration: t.chipDurationMs / 1000, ease: EASE_OUT_CUBIC };

	const chipAnimation: CollectionChipAnimationConfig = {
		wrapperMaxWidthExpanded: `${WRAPPER_MAX_WIDTH_REM}rem`,
		initialScale: 0.95,
		finalScale: 1,
		wrapperTransition,
		chipTransition,
		chipAppearDelayMs: t.chipDelayMs,
	};

	const chipsWrapperTransition = shouldReduceMotion
		? { duration: 0 }
		: {
				duration: INITIAL_LOAD_WRAPPER_DURATION_MS / 1000,
				ease: EASE_OUT_CUBIC,
			};

	const {
		activeCollectionId,
		setActiveCollectionId,
		triggerBookmarkRefetch,
		view,
		setView,
		searchQuery,
		setSearchQuery,
	} = useCollection();

	const [collections, setCollections] = useState<HeaderCollection[]>([]);
	const [isLoadingCollections, setIsLoadingCollections] = useState(true);
	const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [newChipStage, setNewChipStage] = useState(0);
	const hasAnimatedInitialLoad = useRef(false);

	// ─── new collection flow ──────────────────────────────────────────────────
	const [newCollectionStage, setNewCollectionStage] = useState(0);
	const [newCollectionName, setNewCollectionName] = useState("");
	const newCollectionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const newCollectionInputRef = useRef<HTMLInputElement | null>(null);

	// ─── search flow ──────────────────────────────────────────────────────────
	const [searchStage, setSearchStage] = useState(0);
	const [searchInputValue, setSearchInputValue] = useState("");
	const searchTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const searchInputRef = useRef<HTMLInputElement | null>(null);

	const headerPillRef = useRef<HTMLDivElement | null>(null);
	const isExpanded = newCollectionStage > 0 || searchStage > 0;
	const chipsHidden = newCollectionStage >= 1 || searchStage >= 1;

	// ─── initial load animation ───────────────────────────────────────────────
	useEffect(() => {
		if (isLoadingCollections || collections.length === 0) return;
		if (hasAnimatedInitialLoad.current) return;
		const lastChipStart =
			(collections.length - 1) * INITIAL_LOAD_STAGGER_MS +
			t.wrapperDurationMs +
			t.chipDelayMs +
			t.chipDurationMs;
		const id = setTimeout(() => {
			hasAnimatedInitialLoad.current = true;
		}, lastChipStart + 50);
		return () => clearTimeout(id);
	}, [
		isLoadingCollections,
		collections.length,
		t.wrapperDurationMs,
		t.chipDelayMs,
		t.chipDurationMs,
	]);

	// ─── fetch collections ────────────────────────────────────────────────────
	const fetchCollections = useCallback(async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			setIsLoadingCollections(false);
			return;
		}
		const { data, error } = await api.collections.get();
		if (error) {
			console.error("Failed to fetch collections:", error);
			setIsLoadingCollections(false);
			return;
		}
		if (data && Array.isArray(data))
			setCollections(data.map((c) => ({ id: c.id, name: c.name })));
		setIsLoadingCollections(false);
	}, []);

	useEffect(() => {
		fetchCollections();
	}, [fetchCollections]);
	useEffect(() => {
		const handler = () => fetchCollections();
		window.addEventListener("collection:restored", handler);
		return () => window.removeEventListener("collection:restored", handler);
	}, [fetchCollections]);

	// ─── new chip stage ───────────────────────────────────────────────────────
	useEffect(() => {
		if (!newlyCreatedId) {
			setNewChipStage(0);
			return;
		}
		setNewChipStage(0);
		const timers: ReturnType<typeof setTimeout>[] = [];
		timers.push(setTimeout(() => setNewChipStage(1), t.wrapperStartMs));
		timers.push(
			setTimeout(() => setNewChipStage(2), t.wrapperStartMs + t.chipDelayMs),
		);
		timers.push(setTimeout(() => setNewlyCreatedId(null), t.clearNewIdAfterMs));
		return () => timers.forEach(clearTimeout);
	}, [newlyCreatedId]);

	// ─── new collection stage machine ────────────────────────────────────────
	useEffect(() => {
		newCollectionTimersRef.current.forEach(clearTimeout);
		newCollectionTimersRef.current = [];
		if (shouldReduceMotion) {
			if (newCollectionStage > 0 && newCollectionStage < 3)
				setNewCollectionStage(3);
			return;
		}
		if (newCollectionStage === 0 || newCollectionStage >= 3) return;
		const toStage2 = setTimeout(
			() => setNewCollectionStage(2),
			NEW_COLLECTION_TIMING.chipsExitDone - NEW_COLLECTION_TIMING.chipsExit,
		);
		const toStage3 = setTimeout(
			() => setNewCollectionStage(3),
			NEW_COLLECTION_TIMING.inputReady - NEW_COLLECTION_TIMING.chipsExit,
		);
		newCollectionTimersRef.current = [toStage2, toStage3];
		return () => {
			newCollectionTimersRef.current.forEach(clearTimeout);
			newCollectionTimersRef.current = [];
		};
	}, [newCollectionStage, shouldReduceMotion]);

	useEffect(() => {
		if (newCollectionStage === 3) newCollectionInputRef.current?.focus();
	}, [newCollectionStage]);

	// ─── search stage machine ─────────────────────────────────────────────────
	useEffect(() => {
		searchTimersRef.current.forEach(clearTimeout);
		searchTimersRef.current = [];
		if (shouldReduceMotion) {
			if (searchStage > 0 && searchStage < 3) setSearchStage(3);
			return;
		}
		if (searchStage === 0 || searchStage >= 3) return;
		const toStage2 = setTimeout(
			() => setSearchStage(2),
			NEW_COLLECTION_TIMING.chipsExitDone - NEW_COLLECTION_TIMING.chipsExit,
		);
		const toStage3 = setTimeout(
			() => setSearchStage(3),
			NEW_COLLECTION_TIMING.inputReady - NEW_COLLECTION_TIMING.chipsExit,
		);
		searchTimersRef.current = [toStage2, toStage3];
		return () => {
			searchTimersRef.current.forEach(clearTimeout);
			searchTimersRef.current = [];
		};
	}, [searchStage, shouldReduceMotion]);

	useEffect(() => {
		if (searchStage === 3) searchInputRef.current?.focus();
	}, [searchStage]);

	// ─── close on outside click ───────────────────────────────────────────────
	useEffect(() => {
		if (!isExpanded) return;
		const handlePointerDown = (event: PointerEvent) => {
			const pill = headerPillRef.current;
			if (!pill || pill.contains(event.target as Node)) return;
			resetNewCollectionFlow();
			resetSearchFlow();
		};
		document.addEventListener("pointerdown", handlePointerDown, true);
		return () =>
			document.removeEventListener("pointerdown", handlePointerDown, true);
	}, [isExpanded]);

	const resetNewCollectionFlow = () => {
		setNewCollectionStage(0);
		setNewCollectionName("");
	};

	const resetSearchFlow = () => {
		setSearchStage(0);
		setSearchInputValue("");
		setSearchQuery("");
	};

	// ─── create collection ────────────────────────────────────────────────────
	const handleCreateCollection = async (name: string) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		const { data, error } = await api.collections.post({ name });
		if (error) {
			console.error("Failed to create collection:", error);
			setIsSubmitting(false);
			return;
		}
		if (data && "id" in data) {
			setCollections((prev) => [...prev, { id: data.id, name: data.name }]);
			setNewlyCreatedId(data.id);
			trigger([{ duration: 50 }], { intensity: 0.77 });
		}
		setIsSubmitting(false);
	};

	// ─── delete collection ────────────────────────────────────────────────────
	const handleDeleteCollection = async (
		collectionId: string,
		mode: "trash" | "keep-bookmarks",
	) => {
		setCollections((prev) => prev.filter((c) => c.id !== collectionId));
		if (activeCollectionId === collectionId) setActiveCollectionId(null);
		if (mode === "trash") {
			const { error } = await api
				.collections({ id: collectionId })
				.trash.patch({});
			if (error) {
				console.error("Failed to trash collection:", error);
				const { data } = await api.collections.get();
				if (data && Array.isArray(data))
					setCollections(data.map((c) => ({ id: c.id, name: c.name })));
			}
		} else {
			const { error } = await api
				.collections({ id: collectionId })
				["keep-bookmarks"].delete({});
			if (error) {
				console.error("Failed to delete collection:", error);
				const { data } = await api.collections.get();
				if (data && Array.isArray(data))
					setCollections(data.map((c) => ({ id: c.id, name: c.name })));
			}
		}
		triggerBookmarkRefetch();
	};

	usePasteBookmark(activeCollectionId);

	return (
		<header
			ref={ref}
			className={cn(
				"flex w-full shrink-0 items-center justify-center pt-[max(1.25rem,env(safe-area-inset-top))] pb-8",
				className,
			)}
			{...props}
		>
			<div className="no-drag flex min-w-0 items-center gap-1.5 w-full justify-center">
				<div
					ref={headerPillRef}
					className="flex min-w-0 items-center overflow-hidden rounded-full bg-muted p-1 relative"
				>
					<div className="flex min-w-0 flex-1 items-center overflow-hidden">
						{/* ── All tab + chips + Trash — hidden while either flow is open ── */}
						<motion.div
							className="flex items-center overflow-hidden"
							initial={false}
							animate={{
								opacity: chipsHidden ? 0 : 1,
								y: chipsHidden ? NEW_COLLECTION_CHIPS.exitOffsetY : 0,
								maxWidth: chipsHidden ? 0 : 400,
							}}
							transition={
								shouldReduceMotion
									? { duration: 0 }
									: {
											opacity: NEW_COLLECTION_SPRING,
											y: NEW_COLLECTION_SPRING,
											maxWidth: { ...NEW_COLLECTION_SPRING, stiffness: 280 },
										}
							}
						>
							{/* All tab */}
							<button
								type="button"
								className={cn(
									"relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-primary text-sm outline-none",
									"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									"active:scale-[0.97] [@media(hover:hover)]:hover:opacity-100",
									activeCollectionId === null && view === "inbox"
										? "bg-primary text-primary-foreground"
										: "",
								)}
								onClick={() => {
									if (isExpanded) return;
									setActiveCollectionId(null);
									setView("inbox");
								}}
							>
								All
							</button>

							{/* Chips */}
							<motion.div
								className="flex min-w-0 items-center overflow-hidden"
								initial={false}
								animate={{
									maxWidth:
										isLoadingCollections ||
										collections.length === 0 ||
										chipsHidden
											? 0
											: `${CHIPS_WRAPPER_MAX_WIDTH_REM}rem`,
								}}
								transition={chipsWrapperTransition}
							>
								{collections.map((coll, index) => (
									<CollectionChip
										key={coll.id}
										name={coll.name}
										isSelected={
											activeCollectionId === coll.id && view === "inbox"
										}
										isNew={newlyCreatedId === coll.id}
										newChipStage={newChipStage}
										isInitialLoad={
											!hasAnimatedInitialLoad.current && collections.length > 0
										}
										initialLoadDelayMs={index * INITIAL_LOAD_STAGGER_MS}
										onClick={() => {
											setActiveCollectionId(coll.id);
											setView("inbox");
										}}
										onDelete={(mode) => handleDeleteCollection(coll.id, mode)}
										animation={chipAnimation}
									/>
								))}
							</motion.div>

							{/* Trash tab */}
							<button
								type="button"
								onClick={() => {
									if (isExpanded) return;
									setView("trash");
								}}
								className={cn(
									"relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-2.5 py-1.75 font-medium text-primary text-sm outline-none",
									"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									"active:scale-[0.97] [@media(hover:hover)]:hover:opacity-100",
									view === "trash" ? "bg-primary text-primary-foreground" : "",
								)}
							>
								<IconTrashFilled size={14} />
							</button>
						</motion.div>

						{/* ── New collection: plus + inline input ── */}
						<div className="hidden min-w-0 items-center overflow-hidden sm:flex">
							<motion.div
								className="flex shrink-0 items-center overflow-hidden"
								initial={false}
								animate={{
									opacity: searchStage >= 1 ? 0 : 1,
									maxWidth: searchStage >= 1 ? 0 : 28,
								}}
								transition={
									shouldReduceMotion
										? { duration: 0 }
										: {
												opacity: NEW_COLLECTION_SPRING,
												maxWidth: { ...NEW_COLLECTION_SPRING, stiffness: 280 },
											}
								}
							>
								<motion.button
									type="button"
									className={cn(
										"flex h-7 w-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-tertiary outline-none",
										"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
										"active:scale-[0.90] [@media(hover:hover)]:hover:text-primary",
										searchStage >= 1 ? "pointer-events-none" : "",
									)}
									aria-label={
										newCollectionStage === 0
											? "Create new collection"
											: "Cancel creating collection"
									}
									onClick={() => {
										if (newCollectionStage > 0) {
											resetNewCollectionFlow();
											return;
										}
										if (searchStage > 0) return;
										trigger([{ duration: 50 }], { intensity: 0.77 });
										setNewCollectionStage(1);
									}}
								>
									<IconPlusSm />
								</motion.button>
							</motion.div>

							<motion.form
								className="flex items-center gap-1 overflow-hidden"
								style={{
									pointerEvents: newCollectionStage >= 2 ? "auto" : "none",
								}}
								initial={false}
								animate={{
									opacity: newCollectionStage >= 2 ? 1 : 0,
									maxWidth:
										newCollectionStage >= 2
											? `${NEW_COLLECTION_INPUT.maxWidthRem}rem`
											: 0,
								}}
								transition={
									shouldReduceMotion
										? { duration: 0 }
										: {
												opacity: NEW_COLLECTION_SPRING,
												maxWidth: { ...NEW_COLLECTION_SPRING, stiffness: 280 },
											}
								}
								onSubmit={(event) => {
									event.preventDefault();
									if (isSubmitting) return;
									const name = newCollectionName.trim();
									if (!name) return;
									void handleCreateCollection(name);
									setNewCollectionName("");
									resetNewCollectionFlow();
								}}
							>
								<input
									ref={newCollectionInputRef}
									type="text"
									placeholder="Collection name"
									className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
									value={newCollectionName}
									onChange={(event) => setNewCollectionName(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Escape") {
											event.stopPropagation();
											resetNewCollectionFlow();
										}
									}}
									spellCheck={false}
									autoComplete="off"
									aria-label="Collection name"
									disabled={isSubmitting}
								/>
								<span
									className="flex absolute right-3 mt-0.5 shrink-0 items-center text-muted-foreground"
									aria-hidden
								>
									<IconReturnKeyFill12 size={14} />
								</span>
							</motion.form>
						</div>

						{/* ── Search: magnifier + inline input ── */}
						<div className="hidden min-w-0 items-center overflow-hidden sm:flex">
							<motion.button
								type="button"
								className={cn(
									"flex h-7 w-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-tertiary outline-none",
									"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									"active:scale-[0.90] [@media(hover:hover)]:hover:text-primary",
									newCollectionStage >= 1
										? "pointer-events-none opacity-0"
										: "",
								)}
								aria-label={
									searchStage === 0 ? "Search bookmarks" : "Close search"
								}
								onClick={() => {
									if (searchStage > 0) {
										resetSearchFlow();
										return;
									}
									if (newCollectionStage > 0) return;
									setSearchStage(1);
								}}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									aria-hidden="true"
								>
									<circle
										cx="6"
										cy="6"
										r="4.25"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
									<path
										d="M9.5 9.5L12.5 12.5"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								</svg>
							</motion.button>

							<motion.div
								className="flex items-center gap-1 overflow-hidden"
								style={{
									pointerEvents: searchStage >= 2 ? "auto" : "none",
								}}
								initial={false}
								animate={{
									opacity: searchStage >= 2 ? 1 : 0,
									maxWidth:
										searchStage >= 2 ? `${SEARCH_INPUT.maxWidthRem}rem` : 0,
								}}
								transition={
									shouldReduceMotion
										? { duration: 0 }
										: {
												opacity: NEW_COLLECTION_SPRING,
												maxWidth: { ...NEW_COLLECTION_SPRING, stiffness: 280 },
											}
								}
							>
								<input
									ref={searchInputRef}
									type="text"
									placeholder="Search bookmarks…"
									className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
									value={searchInputValue}
									onChange={(event) => {
										setSearchInputValue(event.target.value);
										setSearchQuery(event.target.value);
									}}
									onKeyDown={(event) => {
										if (event.key === "Escape") {
											event.stopPropagation();
											resetSearchFlow();
										}
									}}
									spellCheck={false}
									autoComplete="off"
									aria-label="Search bookmarks"
								/>
								{searchInputValue && (
									<button
										type="button"
										className="shrink-0 absolute cursor-pointer select-none right-3 text-muted-foreground transition-colors hover:text-foreground"
										onClick={() => {
											setSearchInputValue("");
											setSearchQuery("");
											searchInputRef.current?.focus();
										}}
										aria-label="Clear search"
									>
										<IconDeleteLeftFill18 size={16} />
									</button>
								)}
							</motion.div>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
});

export { Header };
