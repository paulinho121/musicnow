CREATE TABLE "song_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"label" text NOT NULL,
	"instrument" "instrument",
	"pages" jsonb NOT NULL,
	"total_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "song_score" ADD CONSTRAINT "song_score_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_score" ADD CONSTRAINT "song_score_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "song_score_song_id_index" ON "song_score" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "song_score_uploaded_by_index" ON "song_score" USING btree ("uploaded_by");