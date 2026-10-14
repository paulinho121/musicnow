CREATE TABLE "band_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"bio" text,
	"genres" text,
	"whatsapp" text,
	"instagram" text,
	"youtube" text,
	"setlist_id" uuid,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_page_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"event_date" date,
	"event_type" text,
	"location" text,
	"message" text,
	"status" text DEFAULT 'novo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "band_page" ADD CONSTRAINT "band_page_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_page" ADD CONSTRAINT "band_page_setlist_id_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_request" ADD CONSTRAINT "quote_request_band_page_id_band_page_id_fk" FOREIGN KEY ("band_page_id") REFERENCES "public"."band_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "band_page_slug_index" ON "band_page" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "band_page_owner_id_index" ON "band_page" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "quote_request_band_page_id_created_at_index" ON "quote_request" USING btree ("band_page_id","created_at");