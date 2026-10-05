CREATE TABLE "song_share" (
	"song_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_share_song_id_user_id_pk" PRIMARY KEY("song_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "song" ADD COLUMN "share_code" text;--> statement-breakpoint
ALTER TABLE "song_share" ADD CONSTRAINT "song_share_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_share" ADD CONSTRAINT "song_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "song_share_user_id_index" ON "song_share" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "song" ADD CONSTRAINT "song_shareCode_unique" UNIQUE("share_code");