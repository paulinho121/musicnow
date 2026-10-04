ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"user_id" text,
	"ip" text,
	"user_agent" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_visit_created_at_index" ON "page_visit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_visit_path_index" ON "page_visit" USING btree ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_visit_user_id_index" ON "page_visit" USING btree ("user_id");
