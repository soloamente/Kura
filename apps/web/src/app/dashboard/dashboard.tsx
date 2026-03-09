"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { useCollection } from "@/context/collection-context";
import { BookmarkList } from "@/components/bookmark-list";
import { TrashList } from "@/components/trash-list";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Dashboard() {
	const { view, activeCollectionId, triggerBookmarkRefetch } = useCollection();

	// Save link from clipboard — same behavior as Cmd+V paste (used by background context menu).
	const handleSaveFromClipboard = async () => {
		let text: string;
		try {
			text = await navigator.clipboard.readText();
		} catch {
			toast.error("Could not read clipboard");
			return;
		}
		text = text?.trim() ?? "";
		if (!text) {
			toast.error("Clipboard is empty");
			return;
		}
		try {
			new URL(text);
		} catch {
			toast.error("Clipboard does not contain a valid URL");
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
			toast.error("Failed to save bookmark");
			return;
		}

		if (data && "id" in data) {
			toast.success("Bookmark saved", {
				description: text,
				duration: 3000,
			});
			triggerBookmarkRefetch();
		}
	};

	return (
		<main className="flex h-screen flex-col">
			<ContextMenu.Root>
				{/* Full-size trigger so right-click anywhere on the main content (including empty list area) opens this menu. */}
				<ContextMenu.Trigger
					render={
						<div className="flex min-h-0 flex-1 flex-col w-full" />
					}
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
						<ContextMenu.Popup className="z-50 min-w-[180px] rounded-lg border border-border bg-popover py-1 text-xs shadow-lg">
							<ContextMenu.Item
								className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-foreground outline-none data-highlighted:bg-muted"
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
