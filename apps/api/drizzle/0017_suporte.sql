CREATE TABLE "support_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"page" text,
	"user_agent" text,
	"release" text,
	"status" text DEFAULT 'open' NOT NULL,
	"reply" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_ticket_user_id_index" ON "support_ticket" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_ticket_status_index" ON "support_ticket" USING btree ("status");