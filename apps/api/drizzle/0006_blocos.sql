CREATE TABLE "setlist_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setlist_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"style" text,
	"bpm" integer,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "setlist_item" ADD COLUMN "block_id" uuid;--> statement-breakpoint
ALTER TABLE "setlist_block" ADD CONSTRAINT "setlist_block_setlist_id_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "setlist_block_setlist_id_position_index" ON "setlist_block" USING btree ("setlist_id","position");--> statement-breakpoint
ALTER TABLE "setlist_item" ADD CONSTRAINT "setlist_item_block_id_setlist_block_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."setlist_block"("id") ON DELETE set null ON UPDATE no action;