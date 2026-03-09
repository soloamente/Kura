"use client";

import { createContext, useCallback, useContext, useState } from "react";

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
			}}
		>
			{children}
		</CollectionContext.Provider>
	);
}

export const useCollection = () => useContext(CollectionContext);
