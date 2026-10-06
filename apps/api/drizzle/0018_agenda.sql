CREATE TABLE "gig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"location" text,
	"contractor" text,
	"contact" text,
	"fee_cents" integer,
	"paid_at" timestamp with time zone,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"setlist_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gig" ADD CONSTRAINT "gig_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig" ADD CONSTRAINT "gig_setlist_id_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gig_user_id_starts_at_index" ON "gig" USING btree ("user_id","starts_at");