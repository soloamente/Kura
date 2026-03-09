import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const visibilityEnum = pgEnum("visibility", [
	"private",
	"friends",
	"public",
]);

// ─── Collections ─────────────────────────────────────────────────────────────

export const collection = pgTable(
	"collection",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		icon: text("icon"), // emoji or icon name
		color: text("color"), // hex color for UI
		visibility: visibilityEnum("visibility").default("private").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		isTrashed: boolean("is_trashed").default(false).notNull(),
		trashedAt: timestamp("trashed_at"),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("collection_userId_idx").on(table.userId),
		index("collection_visibility_idx").on(table.visibility),
	],
);

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export const bookmark = pgTable(
	"bookmark",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		collectionId: text("collection_id").references(() => collection.id, {
			onDelete: "set null", // bookmark survives if collection is deleted
		}),

		// core
		url: text("url").notNull(),
		title: text("title"),
		description: text("description"),
		image: text("image"), // og:image
		favicon: text("favicon"),
		siteName: text("site_name"),

		// visibility & status
		visibility: visibilityEnum("visibility").default("private").notNull(),
		isRead: boolean("is_read").default(false).notNull(),
		isFavorite: boolean("is_favorite").default(false).notNull(),
		isTrashed: boolean("is_trashed").default(false).notNull(),
		trashedAt: timestamp("trashed_at"), // so you can auto-delete after X days

		// ai enrichment (populated async via Trigger.dev)
		summary: text("summary"),
		transcript: text("transcript"), // for YouTube links
		embeddings: text("embeddings"), // pgvector later, text for now

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("bookmark_userId_idx").on(table.userId),
		index("bookmark_collectionId_idx").on(table.collectionId),
		index("bookmark_visibility_idx").on(table.visibility),
		index("bookmark_isTrashed_idx").on(table.isTrashed),
		index("bookmark_isRead_idx").on(table.isRead),
	],
);

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const tag = pgTable(
	"tag",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("tag_userId_idx").on(table.userId)],
);

// ─── Bookmark <-> Tag (many-to-many) ──────────────────────────────────────────

export const bookmarkTag = pgTable(
	"bookmark_tag",
	{
		bookmarkId: text("bookmark_id")
			.notNull()
			.references(() => bookmark.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("bookmarkTag_bookmarkId_idx").on(table.bookmarkId),
		index("bookmarkTag_tagId_idx").on(table.tagId),
	],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const collectionRelations = relations(collection, ({ one, many }) => ({
	user: one(user, {
		fields: [collection.userId],
		references: [user.id],
	}),
	bookmarks: many(bookmark),
}));

export const bookmarkRelations = relations(bookmark, ({ one, many }) => ({
	user: one(user, {
		fields: [bookmark.userId],
		references: [user.id],
	}),
	collection: one(collection, {
		fields: [bookmark.collectionId],
		references: [collection.id],
	}),
	tags: many(bookmarkTag),
}));

export const tagRelations = relations(tag, ({ one, many }) => ({
	user: one(user, {
		fields: [tag.userId],
		references: [user.id],
	}),
	bookmarks: many(bookmarkTag),
}));

export const bookmarkTagRelations = relations(bookmarkTag, ({ one }) => ({
	bookmark: one(bookmark, {
		fields: [bookmarkTag.bookmarkId],
		references: [bookmark.id],
	}),
	tag: one(tag, {
		fields: [bookmarkTag.tagId],
		references: [tag.id],
	}),
}));
