"use client";

import { cn } from "@Kura/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	IconGear,
	IconHouseFill,
	IconPlusSm,
	IconTrashFilled,
} from "nucleo-micro-bold";
import { IconReturnKeyFill12 } from "nucleo-ui-fill-12";
import { IconCompassFill18, IconDeleteLeftFill18 } from "nucleo-ui-fill-18";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { SettingsModal } from "@/components/settings-modal";
import { useCollection } from "@/context/collection-context";
import { usePasteBookmark } from "@/hooks/use-paste-bookmark";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { CollectionChipAnimationConfig } from "./collection-chip";
import { CollectionChip } from "./collection-chip";

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
	color?: string | null;
	visibility?: "private" | "friends" | "public";
	// set when this is a followed (not owned) collection
	owner?: {
		id: string;
		name: string;
		username: string | null;
		image: string | null;
	} | null;
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
		setSearchQuery,
		followedCollectionIds,
		setFollowedCollectionIds,
	} = useCollection();

	const [collections, setCollections] = useState<HeaderCollection[]>([]);
	const [followedCollections, setFollowedCollections] = useState<
		HeaderCollection[]
	>([]);
	const [isLoadingCollections, setIsLoadingCollections] = useState(true);
	const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [newChipStage, setNewChipStage] = useState(0);
	const hasAnimatedInitialLoad = useRef(false);

	const [settingsOpen, setSettingsOpen] = useState(false);

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
	const pathname = usePathname();
	const isExplorePage = pathname?.startsWith("/explore") ?? false;
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
	}, [isLoadingCollections, collections.length]);

	// ─── fetch collections ────────────────────────────────────────────────────
	const fetchCollections = useCallback(async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			setIsLoadingCollections(false);
			return;
		}
		const [ownRes, followedRes] = await Promise.all([
			api.collections.get(),
			fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/followed-collections`,
				{
					credentials: "include",
				},
			)
				.then((r) => r.json())
				.catch(() => []),
		]);
		if (ownRes.error) {
			console.error("Failed to fetch collections:", ownRes.error);
		} else if (ownRes.data && Array.isArray(ownRes.data)) {
			setCollections(
				ownRes.data.map((c) => ({
					id: c.id,
					name: c.name,
					color: (c as { color?: string | null }).color ?? null,
					visibility: c.visibility as "private" | "friends" | "public",
				})),
			);
		}
		if (Array.isArray(followedRes)) {
			const mapped = followedRes.map(
				(c: {
					id: string;
					name: string;
					user?: {
						id: string;
						name: string;
						username: string | null;
						image: string | null;
					};
					owner?: {
						id: string;
						name: string;
						username: string | null;
						image: string | null;
					};
				}) => ({
					id: c.id,
					name: c.name,
					owner: c.owner ?? c.user ?? null,
				}),
			);
			setFollowedCollections(mapped);
			setFollowedCollectionIds(new Set(mapped.map((c) => c.id)));
		}
		setIsLoadingCollections(false);
	}, [setFollowedCollectionIds]);

	useEffect(() => {
		fetchCollections();
	}, [fetchCollections]);

	// poll followed-collections every 5 s so owner renames/avatar changes appear without a refresh
	useEffect(() => {
		const pollFollowed = async () => {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/me/followed-collections`,
				{ credentials: "include" },
			).catch(() => null);
			if (!res?.ok) return;
			const data = await res.json().catch(() => null);
			if (!Array.isArray(data)) return;
			const mapped = data.map(
				(c: {
					id: string;
					name: string;
					user?: {
						id: string;
						name: string;
						username: string | null;
						image: string | null;
					};
					owner?: {
						id: string;
						name: string;
						username: string | null;
						image: string | null;
					};
				}) => ({
					id: c.id,
					name: c.name,
					owner: c.owner ?? c.user ?? null,
				}),
			);
			setFollowedCollections(mapped);
			setFollowedCollectionIds(new Set(mapped.map((c) => c.id)));
		};
		const intervalId = setInterval(pollFollowed, 5_000);
		return () => clearInterval(intervalId);
	}, [setFollowedCollectionIds]);

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

	const resetNewCollectionFlow = useCallback(() => {
		setNewCollectionStage(0);
		setNewCollectionName("");
	}, []);
	const resetSearchFlow = useCallback(() => {
		setSearchStage(0);
		setSearchInputValue("");
		setSearchQuery("");
	}, [setSearchQuery]);

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
	}, [isExpanded, resetNewCollectionFlow, resetSearchFlow]);

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
			setCollections((prev) => [
				...prev,
				{ id: data.id, name: data.name, visibility: "private" },
			]);
			setNewlyCreatedId(data.id);
			trigger([{ duration: 50 }], { intensity: 0.77 });
		}
		setIsSubmitting(false);
	};

	// ─── update visibility ────────────────────────────────────────────────────
	const handleVisibilityChange = async (
		collectionId: string,
		visibility: "private" | "friends" | "public",
	) => {
		setCollections((prev) =>
			prev.map((c) => (c.id === collectionId ? { ...c, visibility } : c)),
		);
		const { error } = await api
			.collections({ id: collectionId })
			.visibility.patch({ visibility });
		if (error) {
			console.error("Failed to update visibility:", error);
			fetchCollections();
		}
	};

	// ─── rename collection ────────────────────────────────────────────────────
	const handleRenameCollection = async (collectionId: string, name: string) => {
		// optimistic update
		setCollections((prev) =>
			prev.map((c) => (c.id === collectionId ? { ...c, name } : c)),
		);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/collections/${collectionId}`,
				{
					method: "PATCH",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name }),
				},
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
		} catch (err) {
			console.error("Failed to rename collection:", err);
			fetchCollections();
		}
	};

	// ─── change (or remove) collection color ─────────────────────────────────
	const handleCollectionColorChange = async (
		collectionId: string,
		color: string | null,
	) => {
		// optimistic update
		setCollections((prev) =>
			prev.map((c) => (c.id === collectionId ? { ...c, color } : c)),
		);
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/collections/${collectionId}`,
				{
					method: "PATCH",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ color }),
				},
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
		} catch (err) {
			console.error("Failed to update collection color:", err);
			fetchCollections();
		}
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
			<div className="no-drag flex w-full min-w-0 items-center justify-center gap-2">
				{/* ── Pill 1: Dashboard | Explore (view switcher) ── */}
				<div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
					<Link
						href="/dashboard"
						className={cn(
							"flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-sm outline-none transition-colors",
							"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"active:scale-[0.97] [@media(hover:hover)]:hover:opacity-100",
							!isExplorePage
								? "bg-foreground text-background"
								: "text-foreground",
						)}
						aria-current={!isExplorePage ? "page" : undefined}
					>
						<IconHouseFill size={14} aria-hidden />
						<span>Dashboard</span>
					</Link>

					<Link
						href="/explore"
						className={cn(
							"flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-sm outline-none transition-colors",
							"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"active:scale-[0.97] [@media(hover:hover)]:hover:opacity-100",
							isExplorePage
								? "bg-foreground text-background"
								: "text-foreground",
						)}
						aria-current={isExplorePage ? "page" : undefined}
					>
						<IconCompassFill18 size={14} aria-hidden />
						<span>Explore</span>
					</Link>
				</div>

				{/* ── Pill 2: All + chips + Trash + new collection + search (dashboard only) ── */}
				{!isExplorePage && (
					<div
						ref={headerPillRef}
						className="relative flex min-w-0 items-center overflow-hidden rounded-full bg-muted p-1 pr-1.5"
					>
						<div className="flex min-w-0 items-center overflow-hidden">
							{/* ── All tab + chips + Trash — hidden while flow is open ── */}
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
										"relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-sm outline-none",
										"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
										"active:scale-[0.97] [@media(hover:hover)]:hover:opacity-100",
										activeCollectionId === null && view === "inbox"
											? "bg-foreground text-background"
											: "text-foreground",
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
												!hasAnimatedInitialLoad.current &&
												collections.length > 0
											}
											initialLoadDelayMs={index * INITIAL_LOAD_STAGGER_MS}
											onClick={() => {
												setActiveCollectionId(coll.id);
												setView("inbox");
											}}
											onDelete={(mode) => handleDeleteCollection(coll.id, mode)}
											visibility={coll.visibility ?? "private"}
											onVisibilityChange={(v) =>
												handleVisibilityChange(coll.id, v)
											}
											onRename={(name) => handleRenameCollection(coll.id, name)}
											color={coll.color}
											onColorChange={(color) =>
												handleCollectionColorChange(coll.id, color)
											}
											animation={chipAnimation}
										/>
									))}
									{/* ── Followed collections (read-only) ── */}
									{followedCollections.map((coll, index) => (
										<CollectionChip
											key={`followed-${coll.id}`}
											name={coll.name}
											isSelected={
												activeCollectionId === coll.id && view === "inbox"
											}
											isNew={false}
											newChipStage={0}
											isInitialLoad={
												!hasAnimatedInitialLoad.current &&
												followedCollections.length > 0
											}
											initialLoadDelayMs={
												(collections.length + index) * INITIAL_LOAD_STAGGER_MS
											}
											onClick={() => {
												setActiveCollectionId(coll.id);
												setView("inbox");
											}}
											owner={coll.owner}
											onViewCreator={() => {
												if (!coll.owner?.username) return;
												// Navigate to the creator's public profile page
												window.location.assign(`/${coll.owner.username}`);
											}}
											onUnfollowFollowed={async () => {
												const prevFollowedIds = new Set(followedCollectionIds);
												// Optimistically remove this collection from the followed list
												setFollowedCollections((prev) =>
													prev.filter((c) => c.id !== coll.id),
												);
												const nextIds = new Set(prevFollowedIds);
												nextIds.delete(coll.id);
												setFollowedCollectionIds(nextIds);

												const res = await fetch(
													`${process.env.NEXT_PUBLIC_SERVER_URL}/users/collections/${coll.id}/follow`,
													{ method: "DELETE", credentials: "include" },
												);
												if (!res.ok) {
													// Roll back local state on failure
													setFollowedCollections((prev) => [...prev, coll]);
													setFollowedCollectionIds(prevFollowedIds);
												} else {
													// Keep collection-follow achievements in sync
													window.dispatchEvent(
														new CustomEvent("kura:refresh-badges"),
													);
												}
											}}
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
										"relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-2.5 py-1.75 font-medium text-sm outline-none",
										"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
										"active:scale-[0.97] [@media(hover:hover)]:hover:opacity-100",
										view === "trash"
											? "bg-foreground text-background"
											: "text-foreground",
									)}
								>
									<IconTrashFilled size={14} />
								</button>
							</motion.div>

							{/* ── New collection + Search ── */}
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
													maxWidth: {
														...NEW_COLLECTION_SPRING,
														stiffness: 280,
													},
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
													maxWidth: {
														...NEW_COLLECTION_SPRING,
														stiffness: 280,
													},
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
										onChange={(event) =>
											setNewCollectionName(event.target.value)
										}
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
										className="absolute right-3 mt-0.5 flex shrink-0 items-center text-muted-foreground"
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
													maxWidth: {
														...NEW_COLLECTION_SPRING,
														stiffness: 280,
													},
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
											className="absolute right-3 shrink-0 cursor-pointer select-none text-muted-foreground transition-colors hover:text-foreground"
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
				)}
				<button
					type="button"
					onClick={() => setSettingsOpen(true)}
					className={cn(
						"ml-1.5 flex h-7 w-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-tertiary outline-none",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						"active:scale-[0.90] [@media(hover:hover)]:hover:text-primary",
					)}
					aria-label="Open settings"
				>
					<span aria-hidden>
						<IconGear size={16} />
					</span>
				</button>
				<AnimatePresence>
					{settingsOpen && (
						<SettingsModal onClose={() => setSettingsOpen(false)} />
					)}
				</AnimatePresence>
			</div>
		</header>
	);
});

export { Header };
