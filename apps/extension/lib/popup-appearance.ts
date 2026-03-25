/**
 * Popup / options page shared appearance (theme, corners, density).
 * Uses `chrome.storage.local` (reliable in all profiles). Migrates legacy `sync` values once.
 */

export type PopupTheme = "system" | "light" | "dark";
export type PopupRadius = "minimal" | "soft" | "rounded";
export type PopupDensity = "compact" | "comfortable";

export interface PopupAppearance {
	theme: PopupTheme;
	radius: PopupRadius;
	density: PopupDensity;
	/** Tab title + hostname row under the header */
	showCurrentPage: boolean;
	/** Inbox / collection chips (still saves to Inbox when off) */
	showCollectionPicker: boolean;
	/** Recent bookmarks list (data may still load for “already saved” hints) */
	showRecent: boolean;
}

export const APPEARANCE_STORAGE_KEY = "kura_popup_appearance";

export const DEFAULT_APPEARANCE: PopupAppearance = {
	theme: "system",
	radius: "minimal",
	density: "comfortable",
	showCurrentPage: true,
	showCollectionPicker: true,
	showRecent: true,
};

function normalizeAppearance(raw: unknown): PopupAppearance {
	if (!raw || typeof raw !== "object") return DEFAULT_APPEARANCE;
	const o = raw as Record<string, unknown>;
	const theme =
		o.theme === "light" || o.theme === "dark" || o.theme === "system"
			? o.theme
			: DEFAULT_APPEARANCE.theme;
	const radius =
		o.radius === "minimal" || o.radius === "soft" || o.radius === "rounded"
			? o.radius
			: DEFAULT_APPEARANCE.radius;
	const density =
		o.density === "compact" || o.density === "comfortable"
			? o.density
			: DEFAULT_APPEARANCE.density;
	const showCurrentPage =
		typeof o.showCurrentPage === "boolean"
			? o.showCurrentPage
			: DEFAULT_APPEARANCE.showCurrentPage;
	const showCollectionPicker =
		typeof o.showCollectionPicker === "boolean"
			? o.showCollectionPicker
			: DEFAULT_APPEARANCE.showCollectionPicker;
	const showRecent =
		typeof o.showRecent === "boolean"
			? o.showRecent
			: DEFAULT_APPEARANCE.showRecent;
	return {
		theme,
		radius,
		density,
		showCurrentPage,
		showCollectionPicker,
		showRecent,
	};
}

export async function loadAppearance(): Promise<PopupAppearance> {
	const local = await browser.storage.local.get(APPEARANCE_STORAGE_KEY);
	let raw = local[APPEARANCE_STORAGE_KEY];
	// One-time migration from older builds that used `chrome.storage.sync`.
	if (raw === undefined) {
		const sync = await browser.storage.sync.get(APPEARANCE_STORAGE_KEY);
		raw = sync[APPEARANCE_STORAGE_KEY];
		if (raw !== undefined) {
			await browser.storage.local.set({ [APPEARANCE_STORAGE_KEY]: raw });
		}
	}
	return normalizeAppearance(raw);
}

/** Apply `data-*` on `<html>` for CSS (see `popup/style.css`). */
export function applyAppearanceToRoot(
	appearance: PopupAppearance,
	root: HTMLElement = document.documentElement,
): void {
	if (appearance.theme === "system") {
		root.removeAttribute("data-theme");
	} else {
		root.dataset.theme = appearance.theme;
	}
	root.dataset.radius = appearance.radius;
	root.dataset.density = appearance.density;
}

export async function saveAppearance(
	patch: Partial<PopupAppearance>,
): Promise<PopupAppearance> {
	const cur = await loadAppearance();
	const next: PopupAppearance = { ...cur, ...patch };
	await browser.storage.local.set({ [APPEARANCE_STORAGE_KEY]: next });
	applyAppearanceToRoot(next);
	return next;
}
