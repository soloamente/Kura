/**
 * Shared context menu styles for the Kura app.
 * Follows the premium dark-luxury aesthetic: cinematic glass layers,
 * subtle gradients, restrained motion.
 */

import { cn } from "@Kura/ui/lib/utils";

/** Popup surface: frosted glass, soft shadow, smooth open/close. */
export const contextMenuPopupCls = cn(
	"z-[var(--z-dropdown,100)] min-w-[180px] rounded-xl px-1.5 py-1.5 text-sm outline-none",
	"bg-popover/95 backdrop-blur-xl",
	"border border-border/80 shadow-black/15 shadow-xl",
	"data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
	"data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0",
	"origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
);

/** Compact popup for submenus. */
export const contextMenuSubPopupCls = cn(
	contextMenuPopupCls,
	"min-w-[160px] px-1 py-1",
);

/** Menu item: generous padding, cursor-pointer, subtle highlight. */
export const contextMenuItemCls = cn(
	"flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-foreground outline-none",
	"transition-colors duration-75 disabled:cursor-not-allowed data-[highlighted]:bg-muted/70",
);

/** Submenu trigger (e.g. "Move to collection" with chevron). */
export const contextMenuSubmenuTriggerCls = cn(
	contextMenuItemCls,
	"justify-between",
);

/** Separator: soft gradient for refined look. */
export const contextMenuSeparatorCls =
	"my-1.5 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent";

/** Destructive action (trash, delete, unfollow): red tint on highlight. */
export const contextMenuDestructiveItemCls = cn(
	contextMenuItemCls,
	"text-destructive data-[highlighted]:bg-destructive/10",
);
