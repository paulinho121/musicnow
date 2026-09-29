CREATE TYPE "public"."suggestion_status" AS ENUM('open', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "setlist_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setlist_id" uuid NOT NULL,
	"item_id" uuid,
	"author_id" text NOT NULL,
	"proposed_key" text,
	"message" text,
	"status" "suggestion_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "setlist_item" DROP CONSTRAINT "setlist_item_song_id_song_id_fk";
--> statement-breakpoint
ALTER TABLE "setlist_suggestion" ADD CONSTRAINT "setlist_suggestion_setlist_id_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_suggestion" ADD CONSTRAINT "setlist_suggestion_item_id_setlist_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."setlist_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_suggestion" ADD CONSTRAINT "setlist_suggestion_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_suggestion" ADD CONSTRAINT "setlist_suggestion_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "setlist_suggestion_setlist_id_status_index" ON "setlist_suggestion" USING btree ("setlist_id","status");--> statement-breakpoint
ALTER TABLE "setlist_item" ADD CONSTRAINT "setlist_item_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE no action ON UPDATE no action;