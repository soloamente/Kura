"use client";

import { useToast } from "@Kura/ui/components/toast";
import { useCallback, useEffect } from "react";
import { useCollection } from "@/context/collection-context";
import { api } from "@/lib/api";

export function usePasteBookmark(activeCollectionId: string | null) {
	const { triggerBookmarkRefetch } = useCollection();
	const { toast, update, dismiss } = useToast();

	// ─── force-save a duplicate URL ───────────────────────────────────────────
	const saveAnyway = useCallback(
		async (toastId: string, url: string, collectionId: string | null) => {
			dismiss(toastId);
			const id = toast("Saving bookmark…", "loading");
			const { error } = await api.bookmarks.force.post({ url, collectionId });
			if (error) {
				update(id, "Failed to save", "error");
				return;
			}
			update(id, "Bookmark saved", "success");
			// Ask the global badge watcher to re-check unlocks right after a
			// successful bookmark save so new achievements celebrate immediately.
			window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
			triggerBookmarkRefetch();
			// Same polling as Settings → Re-enrich so metadata appears after Trigger runs.
			window.dispatchEvent(new CustomEvent("kura:enrich-started"));
		},
		[dismiss, toast, update, triggerBookmarkRefetch],
	);

	useEffect(() => {
		const handlePaste = async (e: ClipboardEvent) => {
			// ignore pastes that land inside an input, textarea, or contenteditable
			const target = e.target as HTMLElement | null;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable
			)
				return;

			const text = e.clipboardData?.getData("text/plain")?.trim();
			if (!text) return;

			try {
				new URL(text);
			} catch {
				return; // not a URL
			}

			const id = toast("Saving bookmark…", "loading");

			const { error, status } = await api.bookmarks.post({
				url: text,
				collectionId: activeCollectionId ?? null,
			});

			// ─── duplicate detected — show inline actions on the toast ─────────
			if (status === 409) {
				const collectionId = activeCollectionId;
				update(id, "Already saved", "warn", [
					{
						label: "Don't save",
						variant: "secondary",
						onClick: () => dismiss(id),
					},
					{
						label: "Save anyway",
						variant: "primary",
						onClick: () => saveAnyway(id, text, collectionId),
					},
				]);
				return;
			}

			if (error) {
				update(id, "Failed to save", "error");
				return;
			}

			update(id, "Bookmark saved", "success");
			// A fresh bookmark can unlock achievements, so prompt the global
			// badge watcher to diff the unlocked set immediately.
			window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
			triggerBookmarkRefetch();
			window.dispatchEvent(new CustomEvent("kura:enrich-started"));
		};

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [
		activeCollectionId,
		triggerBookmarkRefetch,
		toast,
		update,
		dismiss,
		saveAnyway,
	]);
}
