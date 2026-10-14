CREATE TYPE "public"."entry_kind" AS ENUM('receita', 'despesa', 'cache');--> statement-breakpoint
CREATE TABLE "setlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setlist_id" uuid NOT NULL,
	"kind" "entry_kind" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"user_id" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setlist_entry" ADD CONSTRAINT "setlist_entry_setlist_id_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_entry" ADD CONSTRAINT "setlist_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "setlist_entry_setlist_id_index" ON "setlist_entry" USING btree ("setlist_id");--> statement-breakpoint
CREATE INDEX "setlist_entry_user_id_index" ON "setlist_entry" USING btree ("user_id");