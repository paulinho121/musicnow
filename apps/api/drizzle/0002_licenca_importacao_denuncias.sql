CREATE TYPE "public"."report_reason" AS ENUM('copyright', 'wrong_content', 'offensive', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."song_license" AS ENUM('unknown', 'own', 'public_domain', 'licensed');--> statement-breakpoint
CREATE TABLE "song_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "song" ADD COLUMN "license" "song_license" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "song" ADD COLUMN "imported_from" text;--> statement-breakpoint
ALTER TABLE "song_report" ADD CONSTRAINT "song_report_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_report" ADD CONSTRAINT "song_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "song_report_song_id_index" ON "song_report" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "song_report_status_index" ON "song_report" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "song_report_song_id_reporter_id_index" ON "song_report" USING btree ("song_id","reporter_id");--> statement-breakpoint
-- Músicas públicas já existentes (demo) passam a ter licença informada; o seed ajusta as de domínio público.
UPDATE "song" SET "license" = 'own' WHERE "visibility" = 'public';
