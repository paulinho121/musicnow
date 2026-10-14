CREATE TABLE "rehearsal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setlist_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 120 NOT NULL,
	"studio_name" text,
	"room" text,
	"address" text,
	"phone" text,
	"cost_cents" integer,
	"paid_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehearsal_share" (
	"rehearsal_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "rehearsal_share_rehearsal_id_user_id_pk" PRIMARY KEY("rehearsal_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "rehearsal" ADD CONSTRAINT "rehearsal_setlist_id_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsal" ADD CONSTRAINT "rehearsal_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsal" ADD CONSTRAINT "rehearsal_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsal_share" ADD CONSTRAINT "rehearsal_share_rehearsal_id_rehearsal_id_fk" FOREIGN KEY ("rehearsal_id") REFERENCES "public"."rehearsal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsal_share" ADD CONSTRAINT "rehearsal_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rehearsal_setlist_id_starts_at_index" ON "rehearsal" USING btree ("setlist_id","starts_at");--> statement-breakpoint
CREATE INDEX "rehearsal_share_user_id_index" ON "rehearsal_share" USING btree ("user_id");