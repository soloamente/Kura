"use client";

import { cn } from "@Kura/ui/lib/utils";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableBookmark {
	id: string;
	title: string | null;
	description: string | null;
	url: string;
}

interface EditBookmarkSheetProps {
	bookmark: EditableBookmark;
	onClose: () => void;
	onSave: (patch: { title: string | null; description: string | null }) => void;
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function EditBookmarkSheet({
	bookmark,
	onClose,
	onSave,
}: EditBookmarkSheetProps) {
	const [title, setTitle] = useState(bookmark.title ?? "");
	const [description, setDescription] = useState(bookmark.description ?? "");
	const [saving, setSaving] = useState(false);
	const titleRef = useRef<HTMLInputElement>(null);

	// focus the title field when the sheet opens
	useEffect(() => {
		const timeout = setTimeout(() => titleRef.current?.focus(), 120);
		return () => clearTimeout(timeout);
	}, []);

	// close on Escape
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	const handleSave = async () => {
		if (saving) return;
		setSaving(true);

		const patch = {
			title: title.trim() || null,
			description: description.trim() || null,
		};

		// optimistically notify parent so the list updates immediately
		onSave(patch);

		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/bookmarks/${bookmark.id}`,
				{
					method: "PATCH",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(patch),
				},
			);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
		} catch (err) {
			console.error("Failed to update bookmark:", err);
			// revert optimistic update by restoring original values in parent
			onSave({
				title: bookmark.title,
				description: bookmark.description,
			});
		}

		setSaving(false);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
			{/* backdrop */}
			<motion.div
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				onClick={onClose}
			/>

			{/* sheet */}
			<motion.div
				role="dialog"
				aria-modal="true"
				aria-label="Edit bookmark"
				className={cn(
					"relative z-10 w-full rounded-t-2xl border border-border bg-popover shadow-2xl",
					"sm:max-w-md sm:rounded-2xl",
				)}
				initial={{ opacity: 0, y: "100%" }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: "100%" }}
				transition={{ type: "spring", stiffness: 380, damping: 30 }}
			>
				{/* drag handle (mobile hint) */}
				<div className="flex justify-center pt-3 pb-0 sm:hidden">
					<span className="h-1 w-10 rounded-full bg-border" />
				</div>

				<div className="p-5 pt-4">
					{/* header */}
					<div className="mb-4 flex items-center justify-between">
						<h2 className="font-semibold text-foreground text-sm">
							Edit bookmark
						</h2>
						<button
							type="button"
							onClick={onClose}
							className={cn(
								"flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground",
								"transition-colors hover:bg-muted hover:text-foreground",
							)}
							aria-label="Close"
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M1 1l10 10M11 1L1 11"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						</button>
					</div>

					{/* form */}
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSave();
						}}
						className="flex flex-col gap-3"
					>
						{/* title */}
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="bookmark-title"
								className="font-medium text-muted-foreground text-xs"
							>
								Title
							</label>
							<input
								ref={titleRef}
								id="bookmark-title"
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Bookmark title"
								spellCheck={false}
								autoComplete="off"
								className={cn(
									"w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm outline-none",
									"transition-colors placeholder:text-muted-foreground/50",
									"focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
								)}
							/>
						</div>

						{/* description */}
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="bookmark-description"
								className="font-medium text-muted-foreground text-xs"
							>
								Description
							</label>
							<textarea
								id="bookmark-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Add a description…"
								spellCheck={false}
								rows={3}
								className={cn(
									"w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm outline-none",
									"transition-colors placeholder:text-muted-foreground/50",
									"focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
								)}
							/>
						</div>

						{/* actions */}
						<div className="mt-1 flex justify-end gap-2">
							<button
								type="button"
								onClick={onClose}
								className={cn(
									"cursor-pointer rounded-lg border border-border bg-background px-3.5 py-2 font-medium text-foreground text-sm",
									"transition-colors hover:bg-muted",
								)}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={saving}
								className={cn(
									"cursor-pointer rounded-lg bg-foreground px-3.5 py-2 font-medium text-background text-sm",
									"transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
									"hover:opacity-90",
								)}
							>
								{saving ? "Saving…" : "Save"}
							</button>
						</div>
					</form>
				</div>
			</motion.div>
		</div>
	);
}
