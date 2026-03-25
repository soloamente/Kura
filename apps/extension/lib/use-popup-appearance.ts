import { useLayoutEffect, useState } from "react";
import {
	APPEARANCE_STORAGE_KEY,
	applyAppearanceToRoot,
	DEFAULT_APPEARANCE,
	loadAppearance,
	type PopupAppearance,
} from "./popup-appearance";

/**
 * Loads saved popup look from `chrome.storage.local`, applies to `<html>` before paint where
 * possible, and keeps in sync when the appearance tab updates preferences.
 */
export function usePopupAppearance(): PopupAppearance {
	const [appearance, setAppearance] =
		useState<PopupAppearance>(DEFAULT_APPEARANCE);

	useLayoutEffect(() => {
		const apply = (a: PopupAppearance) => {
			applyAppearanceToRoot(a);
			setAppearance(a);
		};
		void loadAppearance().then(apply);

		const onStorageChange = (
			_changes: Record<string, unknown>,
			area: string,
		) => {
			if (area !== "local" || !(APPEARANCE_STORAGE_KEY in _changes)) return;
			void loadAppearance().then(apply);
		};

		browser.storage.onChanged.addListener(onStorageChange);
		return () => browser.storage.onChanged.removeListener(onStorageChange);
	}, []);

	return appearance;
}
