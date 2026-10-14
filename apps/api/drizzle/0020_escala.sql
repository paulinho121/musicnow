CREATE TYPE "public"."assignment_status" AS ENUM('pendente', 'confirmado', 'recusado');--> statement-breakpoint
CREATE TABLE "setlist_assignment" (
	"setlist_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"instrument" "instrument",
	"status" "assignment_status" DEFAULT 'pendente' NOT NULL,
	"note" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setlist_assignment_setlist_id_user_id_pk" PRIMARY KEY("setlist_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "unavailability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setlist_assignment" ADD CONSTRAINT "setlist_assignment_setlist_id_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_assignment" ADD CONSTRAINT "setlist_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unavailability" ADD CONSTRAINT "unavailability_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "setlist_assignment_user_id_index" ON "setlist_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "unavailability_user_id_starts_on_index" ON "unavailability" USING btree ("user_id","starts_on");