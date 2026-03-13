import type { AchievementRule } from "./achievement-rules";

type BadgeCelebrationLevel = "subtle" | "rare" | "epic";

export interface DefaultAchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	xp: number;
	tier?: number;
	sortOrder: number;
	isDiscoverable: boolean;
	celebration: BadgeCelebrationLevel;
	rule: AchievementRule;
}

// These defaults are only seed material. The runtime engine reads from the
// database-backed achievement definitions so admins can edit them later.
export const DEFAULT_ACHIEVEMENT_DEFINITIONS: DefaultAchievementDefinition[] = [
	{
		id: "first_bookmark",
		name: "First Save",
		description: "Save your first bookmark in Kura.",
		icon: "bookmark-plus",
		xp: 10,
		sortOrder: 10,
		isDiscoverable: true,
		celebration: "subtle",
		rule: {
			type: "metric_threshold",
			metric: "bookmarks_total",
			threshold: 1,
		},
	},
	{
		id: "bookmarks_10",
		name: "Collector I",
		description: "Save 10 bookmarks.",
		icon: "bookmark-stack-1",
		xp: 20,
		tier: 1,
		sortOrder: 20,
		isDiscoverable: true,
		celebration: "subtle",
		rule: {
			type: "metric_threshold",
			metric: "bookmarks_total",
			threshold: 10,
		},
	},
	{
		id: "bookmarks_100",
		name: "Collector II",
		description: "Save 100 bookmarks.",
		icon: "bookmark-stack-2",
		xp: 40,
		tier: 2,
		sortOrder: 30,
		isDiscoverable: true,
		celebration: "rare",
		rule: {
			type: "metric_threshold",
			metric: "bookmarks_total",
			threshold: 100,
		},
	},
	{
		id: "first_favorite",
		name: "Starred",
		description: "Mark a bookmark as a favorite.",
		icon: "star",
		xp: 10,
		sortOrder: 40,
		isDiscoverable: true,
		celebration: "subtle",
		rule: {
			type: "metric_threshold",
			metric: "bookmarks_favorited",
			threshold: 1,
		},
	},
	{
		id: "bookmarks_read_25",
		name: "Well Read",
		description: "Mark 25 bookmarks as read.",
		icon: "book-open",
		xp: 20,
		sortOrder: 50,
		isDiscoverable: true,
		celebration: "rare",
		rule: {
			type: "metric_threshold",
			metric: "bookmarks_read",
			threshold: 25,
		},
	},
	{
		id: "followers_10",
		name: "Getting Noticed",
		description: "Reach 10 followers.",
		icon: "users",
		xp: 30,
		sortOrder: 60,
		isDiscoverable: true,
		celebration: "rare",
		rule: {
			type: "metric_threshold",
			metric: "followers_total",
			threshold: 10,
		},
	},
	{
		id: "followed_collections_5",
		name: "Curator",
		description: "Follow 5 public collections.",
		icon: "collection-follow",
		xp: 15,
		sortOrder: 70,
		isDiscoverable: true,
		celebration: "subtle",
		rule: {
			type: "metric_threshold",
			metric: "followed_collections",
			threshold: 5,
		},
	},
	{
		id: "daily_streak_3",
		name: "On A Roll",
		description: "Be active 3 days in a row.",
		icon: "flame-1",
		xp: 25,
		tier: 1,
		sortOrder: 80,
		isDiscoverable: true,
		celebration: "epic",
		rule: {
			type: "metric_threshold",
			metric: "daily_streak",
			threshold: 3,
		},
	},
];
