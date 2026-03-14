"use client";

import { useState } from "react";
import { ExploreView } from "@/app/explore/explore-view";

type ExploreSegment = "people" | "collections" | "bookmarks";

export function ExplorePageClient() {
	const [segment, setSegment] = useState<ExploreSegment>("people");

	return <ExploreView segment={segment} onSegmentChange={setSegment} />;
}
