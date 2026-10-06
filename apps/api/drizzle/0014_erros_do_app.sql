CREATE TABLE "app_error" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"fingerprint" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"url" text,
	"user_agent" text,
	"release" text,
	"count" integer DEFAULT 1 NOT NULL,
	"last_user_id" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_error_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
ALTER TABLE "app_error" ADD CONSTRAINT "app_error_last_user_id_user_id_fk" FOREIGN KEY ("last_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_error_last_seen_at_index" ON "app_error" USING btree ("last_seen_at");