"use client";

import { cn } from "@Kura/ui/lib/utils";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagToEdit {
	id: string;
	name: string;
	color: string | null;
}

export interface EditTagDialogProps {
	tag: TagToEdit;
	onClose: () => void;
	onSave: (patch: { name: string; color: string | null }) => Promise<void>;
}

// Preset tag colors (hex) — matches CreateTagDialog and collection color UX.
const TAG_COLORS: { hex: string; label: string }[] = [
	{ hex: "#ef4444", label: "Red" },
	{ hex: "#f97316", label: "Orange" },
	{ hex: "#eab308", label: "Amber" },
	{ hex: "#22c55e", label: "Green" },
	{ hex: "#14b8a6", label: "Teal" },
	{ hex: "#3b82f6", label: "Blue" },
	{ hex: "#6366f1", label: "Indigo" },
	{ hex: "#8b5cf6", label: "Violet" },
	{ hex: "#a855f7", label: "Purple" },
	{ hex: "#ec4899", label: "Pink" },
];

// ─── Dialog ───────────────────────────────────────────────────────────────────

/**
 * Dialog to edit an existing tag (name and color).
 * Opened by right-clicking a tag in the Tags submenu.
 */
export function EditTagDialog({ tag, onClose, onSave }: EditTagDialogProps) {
	const [value, setValue] = useState(tag.name);
	const [color, setColor] = useState<string | null>(tag.color);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Sync state when tag prop changes; focus input after animation
	useEffect(() => {
		setValue(tag.name);
		setColor(tag.color);
		setError(null);
		const t = setTimeout(() => inputRef.current?.focus(), 120);
		return () => clearTimeout(t);
	}, [tag.name, tag.color]);

	// Close on Escape
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = value.trim();
		if (!name || saving) return;

		setError(null);
		setSaving(true);

		try {
			await onSave({ name, color });
			onClose();
		} catch {
			setError("Could not update tag. Try again.");
			setSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[var(--z-modal,200)] flex items-center justify-center p-4">
			{/* Backdrop */}
			<motion.div
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				onClick={onClose}
			/>

			{/* Dialog card */}
			<motion.div
				role="dialog"
				aria-modal="true"
				aria-labelledby="edit-tag-title"
				aria-describedby="edit-tag-desc"
				className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-popover p-4 shadow-xl"
				initial={{ opacity: 0, scale: 0.95, y: 8 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 8 }}
				transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
				onClick={(e) => e.stopPropagation()}
			>
				<h2 id="edit-tag-title" className="font-medium text-foreground text-sm">
					Edit tag
				</h2>
				<p id="edit-tag-desc" className="sr-only">
					Change the tag name or color.
				</p>

				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					{/* Tag name */}
					<label htmlFor="edit-tag-input" className="sr-only">
						Tag name
					</label>
					<input
						ref={inputRef}
						id="edit-tag-input"
						type="text"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						placeholder="Tag name"
						spellCheck={false}
						autoComplete="off"
						disabled={saving}
						className={cn(
							"w-full rounded-lg border px-3 py-2 text-foreground text-sm outline-none",
							"transition-colors placeholder:text-muted-foreground/50",
							"focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
							error
								? "border-destructive ring-1 ring-destructive/20"
								: "border-border",
							"disabled:cursor-not-allowed disabled:opacity-50",
						)}
						aria-invalid={!!error}
						aria-describedby={error ? "edit-tag-error" : undefined}
					/>

					{/* Color picker */}
					<div className="flex flex-col gap-1.5">
						<span className="font-medium text-muted-foreground text-xs">
							Color
						</span>
						<div className="flex flex-wrap gap-1.5">
							{/* None option */}
							<button
								type="button"
								onClick={() => setColor(null)}
								className={cn(
									"flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-colors",
									color === null
										? "scale-110 border-foreground"
										: "border-border hover:border-foreground/50",
								)}
								title="No color"
								aria-pressed={color === null}
							>
								<span className="size-4 rounded-full border border-border bg-muted" />
							</button>
							{TAG_COLORS.map(({ hex, label }) => (
								<button
									key={hex}
									type="button"
									onClick={() => setColor(hex)}
									className={cn(
										"size-7 cursor-pointer rounded-full border-2 transition-colors",
										color === hex
											? "scale-110 border-foreground"
											: "border-transparent hover:border-border",
									)}
									style={{ backgroundColor: hex }}
									title={label}
									aria-pressed={color === hex}
								/>
							))}
						</div>
					</div>

					{error && (
						<p
							id="edit-tag-error"
							className="text-destructive text-xs"
							role="alert"
						>
							{error}
						</p>
					)}

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							disabled={saving}
							className={cn(
								"cursor-pointer rounded-lg border border-border bg-transparent px-3 py-2 font-medium text-muted-foreground text-sm",
								"transition-colors hover:bg-muted hover:text-foreground",
								"disabled:cursor-not-allowed disabled:opacity-50",
							)}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={saving || !value.trim()}
							className={cn(
								"cursor-pointer rounded-lg bg-foreground px-3 py-2 font-medium text-background text-sm",
								"transition-opacity hover:opacity-90",
								"disabled:cursor-not-allowed disabled:opacity-50",
							)}
						>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</form>
			</motion.div>
		</div>
	);
}
