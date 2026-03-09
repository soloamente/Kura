"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useCollection } from "@/context/collection-context";
import { api } from "@/lib/api";

export function usePasteBookmark(activeCollectionId: string | null) {
	const { triggerBookmarkRefetch } = useCollection();

	useEffect(() => {
		const handlePaste = async (e: ClipboardEvent) => {
			const text = e.clipboardData?.getData("text/plain")?.trim();
			if (!text) return;

			try {
				new URL(text);
			} catch {
				return; // not a URL
			}

			const { data, error, status } = await api.bookmarks.post({
				url: text,
				collectionId: activeCollectionId ?? null,
			});

			// ─── duplicate detected ───────────────────────────────────────────
			if (status === 409) {
				// fire event so BookmarkList can show the dialog
				window.dispatchEvent(
					new CustomEvent("bookmark:duplicate", {
						detail: { url: text, collectionId: activeCollectionId },
					}),
				);
				return;
			}

			if (error) {
				console.error("Failed to save bookmark:", error);
				toast.error("Failed to save bookmark");
				return;
			}

			if (data && "id" in data) {
				toast.success("Bookmark saved", {
					description: text,
					duration: 3000,
				});
				triggerBookmarkRefetch();

				if (data && "id" in data) {
					toast.success("Bookmark saved", {
						description: text,
						duration: 3000,
					});
					triggerBookmarkRefetch();

					// refetch again after enrichment completes (~5s)
					setTimeout(() => triggerBookmarkRefetch(), 5000);
					setTimeout(() => triggerBookmarkRefetch(), 12000);
				}
			}
		};

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [activeCollectionId, triggerBookmarkRefetch]);
}
