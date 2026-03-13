"use client";

/**
 * NewCollectionPopover — popover with form to create a new collection.
 * Owns form state (input value). Calls onSubmit(name) on submit, then closes.
 * Follows Emil's component design: clear props API, composition (uses Base UI Popover).
 */

import { cn } from "@Kura/ui/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { IconPlusSm } from "nucleo-micro-bold";
import { useState } from "react";

export interface NewCollectionPopoverProps {
	/** Controlled open state. */
	open: boolean;
	/** Called when open state should change (e.g. close after submit). */
	onOpenChange: (open: boolean) => void;
	/** Called with the collection name when user submits. Caller can then close popover. */
	onSubmit: (name: string) => void;
	/** Disables the submit button (e.g. while saving). */
	disabled?: boolean;
	/** Optional callback when trigger is clicked (e.g. for haptics). */
	onTriggerClick?: () => void;
	/** Optional callback when submit button is clicked (e.g. for haptics). */
	onSubmitClick?: () => void;
	className?: string;
}

export function NewCollectionPopover({
	open,
	onOpenChange,
	onSubmit,
	disabled = false,
	onTriggerClick,
	onSubmitClick,
	className,
}: NewCollectionPopoverProps) {
	const [inputValue, setInputValue] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (disabled) return;
		const name = inputValue.trim() || "New collection";
		onSubmit(name);
		setInputValue("");
		onOpenChange(false);
	};

	return (
		<Popover.Root open={open} onOpenChange={onOpenChange}>
			<Popover.Trigger
				className={cn(
					"flex shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-tertiary outline-none",
					"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					"active:scale-[0.90] data-popup-open:text-primary [@media(hover:hover)]:hover:text-primary",
				)}
				aria-label="Create new collection"
				onClick={onTriggerClick}
			>
				<IconPlusSm />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Positioner sideOffset={8}>
					<Popover.Popup
						className={
							className ??
							cn(
								/* Emil UI Polish: shadow used as border for better blending with backgrounds. */
								"rounded-xl bg-popover p-1 text-popover-foreground shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1),0_0_0_1px_hsl(var(--foreground)/0.08)] outline-none",
							)
						}
					>
						<Popover.Title className="px-2 pt-2 pb-1 font-medium text-xs">
							Create a new collection
						</Popover.Title>
						<form
							className="flex flex-col gap-2 px-2 pb-2 text-sm"
							onSubmit={handleSubmit}
						>
							{/* Emil UI Polish: shadow as border so input outline blends with backgrounds. */}
							<label className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 shadow-[0_0_0_1px_hsl(var(--input))]">
								<input
									type="text"
									placeholder="Collection name"
									className="w-full min-w-0 bg-transparent text-base outline-none"
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									aria-label="Collection name"
									spellCheck={false}
									autoComplete="off"
								/>
							</label>
							<button
								type="submit"
								disabled={disabled}
								onClick={onSubmitClick}
								className={cn(
									"rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm",
									"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									"transition-opacity active:scale-[0.97] disabled:opacity-50 [@media(hover:hover)]:hover:opacity-90",
								)}
							>
								{disabled ? "Creating…" : "Create"}
							</button>
						</form>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}
