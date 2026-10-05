CREATE TABLE "song_usage" (
	"song_id" uuid NOT NULL,
	"setlist_id" uuid NOT NULL,
	"setlist_owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_usage_song_id_setlist_id_pk" PRIMARY KEY("song_id","setlist_id")
);
--> statement-breakpoint
ALTER TABLE "song" ADD COLUMN "usage_setlists" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "song" ADD COLUMN "usage_people" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "song_usage" ADD CONSTRAINT "song_usage_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Preenchimento inicial: as músicas que já estão nos repertórios de hoje.
INSERT INTO "song_usage" ("song_id", "setlist_id", "setlist_owner_id", "created_at")
SELECT si."song_id", si."setlist_id", s."owner_id", min(s."created_at")
FROM "setlist_item" si JOIN "setlist" s ON s."id" = si."setlist_id"
GROUP BY si."song_id", si."setlist_id", s."owner_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Contadores: só repertórios de OUTRAS pessoas (a dona da música não conta).
UPDATE "song" so SET
  "usage_setlists" = c.setlists,
  "usage_people" = c.people
FROM (
  SELECT u."song_id", count(*)::int AS setlists, count(DISTINCT u."setlist_owner_id")::int AS people
  FROM "song_usage" u JOIN "song" x ON x."id" = u."song_id"
  WHERE u."setlist_owner_id" <> x."owner_id"
  GROUP BY u."song_id"
) c
WHERE so."id" = c."song_id";
