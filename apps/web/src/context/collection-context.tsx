"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type View = "inbox" | "trash";

interface CollectionContextValue {
	activeCollectionId: string | null;
	setActiveCollectionId: (id: string | null) => void;
	bookmarkRefetchKey: number;
	triggerBookmarkRefetch: () => void;
	view: View;
	setView: (view: View) => void;
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	// IDs of collections the user follows (not owns) — used by BookmarkList
	// to decide which endpoint to fetch from
	followedCollectionIds: Set<string>;
	setFollowedCollectionIds: (ids: Set<string>) => void;
	// Whether bookmarks in the inbox view should be grouped into date buckets
	// like "Today" / "Last week" instead of a single flat list.
	groupByDateAdded: boolean;
	setGroupByDateAdded: (value: boolean) => void;
}

const CollectionContext = createContext<CollectionContextValue>({
	activeCollectionId: null,
	setActiveCollectionId: () => {},
	bookmarkRefetchKey: 0,
	triggerBookmarkRefetch: () => {},
	view: "inbox",
	setView: () => {},
	searchQuery: "",
	setSearchQuery: () => {},
	followedCollectionIds: new Set(),
	setFollowedCollectionIds: () => {},
	groupByDateAdded: true,
	setGroupByDateAdded: () => {},
});

export function CollectionProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
		null,
	);
	const [bookmarkRefetchKey, setBookmarkRefetchKey] = useState(0);
	const [view, setView] = useState<View>("inbox");
	const [searchQuery, setSearchQuery] = useState("");
	const [followedCollectionIds, setFollowedCollectionIds] = useState<
		Set<string>
	>(new Set());
	const [groupByDateAdded, setGroupByDateAdded] = useState<boolean>(true);

	// Persist the grouping preference locally so the bookmark layout stays
	// consistent across sessions on the same device.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = window.localStorage.getItem("kura.groupByDateAdded");
		if (stored === null) return;
		setGroupByDateAdded(stored === "true");
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(
			"kura.groupByDateAdded",
			groupByDateAdded ? "true" : "false",
		);
	}, [groupByDateAdded]);

	const triggerBookmarkRefetch = useCallback(() => {
		setBookmarkRefetchKey((k) => k + 1);
	}, []);

	return (
		<CollectionContext.Provider
			value={{
				activeCollectionId,
				setActiveCollectionId,
				bookmarkRefetchKey,
				triggerBookmarkRefetch,
				view,
				setView,
				searchQuery,
				setSearchQuery,
				followedCollectionIds,
				setFollowedCollectionIds,
				groupByDateAdded,
				setGroupByDateAdded,
			}}
		>
			{children}
		</CollectionContext.Provider>
	);
}

export const useCollection = () => useContext(CollectionContext);
