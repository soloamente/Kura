-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."achievement_kind" AS ENUM('bookmarks_total', 'bookmarks_read', 'bookmarks_favorited', 'public_collections', 'followers_total', 'followed_collections', 'account_age', 'daily_streak', 'xp_level');--> statement-breakpoint
CREATE TYPE "public"."admin_action" AS ENUM('ban_user', 'unban_user');--> statement-breakpoint
CREATE TYPE "public"."badge_celebration" AS ENUM('subtle', 'rare', 'epic');--> statement-breakpoint
CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'accepted', 'denied');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'banned');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'friends', 'public');--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"bio" text,
	"banner" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"banned_at" timestamp,
	"ban_reason" text,
	"banned_by_user_id" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "bookmark" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"image" text,
	"favicon" text,
	"site_name" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp,
	"summary" text,
	"transcript" text,
	"embeddings" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmark_tag" (
	"bookmark_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "collection_follow" (
	"follower_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_follow" (
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievement" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"kind" "achievement_kind" NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"tier" integer,
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievement_stats" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total_bookmarks" integer DEFAULT 0 NOT NULL,
	"total_read_bookmarks" integer DEFAULT 0 NOT NULL,
	"total_favorite_bookmarks" integer DEFAULT 0 NOT NULL,
	"total_public_collections" integer DEFAULT 0 NOT NULL,
	"total_followers" integer DEFAULT 0 NOT NULL,
	"total_followed_collections" integer DEFAULT 0 NOT NULL,
	"current_daily_streak" integer DEFAULT 0 NOT NULL,
	"longest_daily_streak" integer DEFAULT 0 NOT NULL,
	"last_activity_date" timestamp,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"extra" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievement_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"tier" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_discoverable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"celebration" "badge_celebration" DEFAULT 'subtle' NOT NULL,
	"rule" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_action_log" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text,
	"target_user_id" text,
	"action" "admin_action" NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendship" (
	"user_id_a" text NOT NULL,
	"user_id_b" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friendship_pair_unique" UNIQUE("user_id_a","user_id_b")
);
--> statement-breakpoint
CREATE TABLE "friend_request" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "share" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"bookmark_id" text,
	"collection_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_banned_by_user_id_user_id_fk" FOREIGN KEY ("banned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_tag" ADD CONSTRAINT "bookmark_tag_bookmark_id_bookmark_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmark"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_tag" ADD CONSTRAINT "bookmark_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_follow" ADD CONSTRAINT "collection_follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_follow" ADD CONSTRAINT "collection_follow_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_following_id_user_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievement_stats" ADD CONSTRAINT "user_achievement_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action_log" ADD CONSTRAINT "admin_action_log_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action_log" ADD CONSTRAINT "admin_action_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_id_a_user_id_fk" FOREIGN KEY ("user_id_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_id_b_user_id_fk" FOREIGN KEY ("user_id_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_addressee_id_user_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_bookmark_id_bookmark_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmark"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tag_userId_idx" ON "tag" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier" text_ops);--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "bookmark_collectionId_idx" ON "bookmark" USING btree ("collection_id" text_ops);--> statement-breakpoint
CREATE INDEX "bookmark_isRead_idx" ON "bookmark" USING btree ("is_read" bool_ops);--> statement-breakpoint
CREATE INDEX "bookmark_isTrashed_idx" ON "bookmark" USING btree ("is_trashed" bool_ops);--> statement-breakpoint
CREATE INDEX "bookmark_userId_idx" ON "bookmark" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "bookmark_visibility_idx" ON "bookmark" USING btree ("visibility" enum_ops);--> statement-breakpoint
CREATE INDEX "bookmarkTag_bookmarkId_idx" ON "bookmark_tag" USING btree ("bookmark_id" text_ops);--> statement-breakpoint
CREATE INDEX "bookmarkTag_tagId_idx" ON "bookmark_tag" USING btree ("tag_id" text_ops);--> statement-breakpoint
CREATE INDEX "collection_userId_idx" ON "collection" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "collection_visibility_idx" ON "collection" USING btree ("visibility" enum_ops);--> statement-breakpoint
CREATE INDEX "collectionFollow_collectionId_idx" ON "collection_follow" USING btree ("collection_id" text_ops);--> statement-breakpoint
CREATE INDEX "collectionFollow_followerId_idx" ON "collection_follow" USING btree ("follower_id" text_ops);--> statement-breakpoint
CREATE INDEX "uf_followerId_idx" ON "user_follow" USING btree ("follower_id" text_ops);--> statement-breakpoint
CREATE INDEX "uf_followingId_idx" ON "user_follow" USING btree ("following_id" text_ops);--> statement-breakpoint
CREATE INDEX "userAchievement_achievement_idx" ON "user_achievement" USING btree ("user_id" text_ops,"achievement_id" text_ops);--> statement-breakpoint
CREATE INDEX "userAchievement_userId_idx" ON "user_achievement" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "achievementDefinition_active_idx" ON "achievement_definition" USING btree ("is_active" bool_ops,"is_archived" bool_ops);--> statement-breakpoint
CREATE INDEX "achievementDefinition_sort_idx" ON "achievement_definition" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "adminActionLog_admin_idx" ON "admin_action_log" USING btree ("admin_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "adminActionLog_target_idx" ON "admin_action_log" USING btree ("target_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "friendship_user_id_a_idx" ON "friendship" USING btree ("user_id_a" text_ops);--> statement-breakpoint
CREATE INDEX "friendship_user_id_b_idx" ON "friendship" USING btree ("user_id_b" text_ops);--> statement-breakpoint
CREATE INDEX "friend_request_addressee_idx" ON "friend_request" USING btree ("addressee_id" text_ops);--> statement-breakpoint
CREATE INDEX "friend_request_requester_addressee_idx" ON "friend_request" USING btree ("requester_id" text_ops,"addressee_id" text_ops);--> statement-breakpoint
CREATE INDEX "friend_request_requester_idx" ON "friend_request" USING btree ("requester_id" text_ops);--> statement-breakpoint
CREATE INDEX "share_recipient_idx" ON "share" USING btree ("recipient_id" text_ops);
*/