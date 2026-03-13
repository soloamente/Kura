"use client";

import { cn } from "@Kura/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type TitleState = "idle" | "loading" | "generated" | "error";

interface BookmarkTitleProps {
	bookmarkId: string;
	initialTitle: string | null;
	url: string;
	autoGenerate?: boolean;
	className?: string;
}

function isRawUrl(title: string | null, url: string): boolean {
	if (!title) return true;
	try {
		const domain = new URL(url).hostname;
		return title === url || title === domain || title.startsWith("http");
	} catch {
		return false;
	}
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function ShimmerTitle() {
	return (
		<span className="flex items-center gap-1.5">
			<span className="h-3.5 w-32 animate-pulse rounded-md bg-muted" />
			<span className="flex items-center gap-0.5">
				{[0, 1, 2].map((i) => (
					<motion.span
						key={i}
						className="size-1 rounded-full bg-primary/40"
						animate={{ opacity: [0.3, 1, 0.3] }}
						transition={{
							duration: 1.2,
							repeat: Number.POSITIVE_INFINITY,
							delay: i * 0.2,
							ease: "easeInOut",
						}}
					/>
				))}
			</span>
		</span>
	);
}

// ─── Generated title ──────────────────────────────────────────────────────────

function GeneratedTitle({
	title,
	className,
}: {
	title: string;
	className?: string;
}) {
	return (
		<motion.span
			className={cn("relative inline-block", className)}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.2 }}
		>
			{/* highlight flash */}
			<motion.span
				className="absolute inset-0 -mx-1 rounded-sm"
				initial={{ backgroundColor: "hsl(var(--primary) / 0.25)" }}
				animate={{ backgroundColor: "hsl(var(--primary) / 0)" }}
				transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
				aria-hidden
			/>
			{/* letter-by-letter blur reveal */}
			{title.split("").map((char, i) => (
				<motion.span
					key={i}
					initial={{ opacity: 0, filter: "blur(4px)" }}
					animate={{ opacity: 1, filter: "blur(0px)" }}
					transition={{ duration: 0.3, delay: i * 0.018, ease: "easeOut" }}
				>
					{char}
				</motion.span>
			))}
		</motion.span>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function BookmarkTitle({
	bookmarkId,
	initialTitle,
	url,
	autoGenerate = true,
	className,
}: BookmarkTitleProps) {
	const [title, setTitle] = useState<string | null>(initialTitle);
	const [state, setState] = useState<TitleState>("idle");
	const hasGenerated = useRef(false);

	// ✅ useCallback so the function ref is stable and useEffect can depend on it
	const generateTitle = useCallback(async () => {
		setState((s) => {
			if (s === "loading") return s;
			return "loading";
		});

		try {
			// ✅ correct Eden Treaty syntax for /:id/generate-title
			const { data, error } = await api
				.bookmarks({ id: bookmarkId })
				["generate-title"].post({});

			if (error || !data || !("title" in data) || !data.title) {
				console.error("generate-title error:", error);
				setState("error");
				return;
			}

			setTitle(data.title as string);
			setState("generated");
		} catch (e) {
			console.error("generate-title threw:", e);
			setState("error");
		}
	}, [bookmarkId]);

	// auto-generate on mount if title is missing or raw URL
	useEffect(() => {
		if (!autoGenerate) return;
		if (hasGenerated.current) return;
		if (!isRawUrl(initialTitle, url)) return;
		hasGenerated.current = true;
		generateTitle();
	}, [autoGenerate, generateTitle, initialTitle, url]);

	let displayTitle: string;
	try {
		displayTitle = title ?? new URL(url).hostname;
	} catch {
		displayTitle = title ?? url;
	}

	const needsTitle = isRawUrl(title, url);

	return (
		<span
			className={cn(
				"relative inline-flex min-w-0 items-center gap-1.5",
				className,
			)}
		>
			<AnimatePresence mode="wait">
				{state === "loading" ? (
					<motion.span
						key="loading"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
					>
						<ShimmerTitle />
					</motion.span>
				) : state === "generated" ? (
					<GeneratedTitle
						key={`generated-${title}`}
						title={displayTitle}
						className={className}
					/>
				) : (
					<motion.span
						key="idle"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="truncate"
					>
						{displayTitle}
					</motion.span>
				)}
			</AnimatePresence>

			{/* AI pill — only when title is still raw/missing, shown on group hover.
			    We deliberately avoid a <button> here because the entire row is already a <button>
			    in BookmarkRow; nesting buttons would violate HTML rules and break hydration. */}
			{state !== "loading" && state !== "generated" && needsTitle && (
				// biome-ignore lint/a11y/useSemanticElements: parent row is a button; nesting <button> is invalid
				<div
					role="button"
					tabIndex={0}
					onClick={(e) => {
						e.stopPropagation();
						generateTitle();
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							e.stopPropagation();
							generateTitle();
						}
					}}
					className={cn(
						"shrink-0 rounded px-1 py-0.5 font-medium text-[10px]",
						"bg-primary/10 text-primary transition-colors hover:bg-primary/20",
						"opacity-0 group-hover:opacity-100",
					)}
					title="Generate title with AI"
					aria-label="Generate title with AI"
				>
					AI
				</div>
			)}
		</span>
	);
}
