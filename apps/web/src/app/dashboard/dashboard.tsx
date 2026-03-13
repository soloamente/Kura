"use client";

import { useToast } from "@Kura/ui/components/toast";
import { ContextMenu } from "@base-ui/react/context-menu";
import { BookmarkList } from "@/components/bookmark-list";
import { TrashList } from "@/components/trash-list";
import { useCollection } from "@/context/collection-context";
import { api } from "@/lib/api";
import {
	contextMenuItemCls,
	contextMenuPopupCls,
} from "@/lib/context-menu-styles";

export default function Dashboard() {
	const { view, activeCollectionId, triggerBookmarkRefetch } = useCollection();

	const { toast } = useToast();

	// Save link from clipboard — same behavior as Cmd+V paste (used by background context menu).
	const handleSaveFromClipboard = async () => {
		let text: string;
		try {
			text = await navigator.clipboard.readText();
		} catch {
			toast("Could not read clipboard", "error");
			return;
		}
		text = text?.trim() ?? "";
		if (!text) {
			toast("Clipboard is empty", "error");
			return;
		}
		try {
			new URL(text);
		} catch {
			toast("Clipboard does not contain a valid URL", "error");
			return;
		}

		const { data, error, status } = await api.bookmarks.post({
			url: text,
			collectionId: activeCollectionId ?? null,
		});

		if (status === 409) {
			window.dispatchEvent(
				new CustomEvent("bookmark:duplicate", {
					detail: { url: text, collectionId: activeCollectionId },
				}),
			);
			return;
		}

		if (error) {
			console.error("Failed to save bookmark:", error);
			toast("Failed to save bookmark", "error");
			return;
		}

		if (data && "id" in data) {
			toast("Bookmark saved", "success");
			// Prompt the global badge watcher so unlock celebrations appear
			// immediately after saving a bookmark from the context menu.
			window.dispatchEvent(new CustomEvent("kura:refresh-badges"));
			triggerBookmarkRefetch();
		}
	};

	return (
		<main className="flex h-screen flex-col">
			<ContextMenu.Root>
				{/* Full-size trigger so right-click anywhere on the main content (including empty list area) opens this menu. */}
				<ContextMenu.Trigger
					render={<div className="flex min-h-0 w-full flex-1 flex-col" />}
				>
					<div className={view === "inbox" ? "contents" : "hidden"}>
						<BookmarkList />
					</div>
					<div className={view === "trash" ? "contents" : "hidden"}>
						<TrashList />
					</div>
				</ContextMenu.Trigger>

				<ContextMenu.Portal>
					<ContextMenu.Backdrop className="fixed inset-0 bg-transparent" />
					<ContextMenu.Positioner>
						<ContextMenu.Popup className={contextMenuPopupCls}>
							<ContextMenu.Item
								className={contextMenuItemCls}
								onClick={() => void handleSaveFromClipboard()}
							>
								<span>Save link from clipboard</span>
							</ContextMenu.Item>
						</ContextMenu.Popup>
					</ContextMenu.Positioner>
				</ContextMenu.Portal>
			</ContextMenu.Root>
		</main>
	);
}
