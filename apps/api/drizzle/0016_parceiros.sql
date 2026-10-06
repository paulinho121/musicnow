CREATE TABLE "partner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"user_id" text,
	"pix_key" text,
	"commission_percent" integer DEFAULT 50 NOT NULL,
	"trial_days" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "partner_referral" (
	"user_id" text PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"status" text DEFAULT 'signed' NOT NULL,
	"plan" text,
	"payment_id" text,
	"payment_cents" integer,
	"commission_cents" integer,
	"converted_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_referral" ADD CONSTRAINT "partner_referral_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_referral" ADD CONSTRAINT "partner_referral_partner_id_partner_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_referral_partner_id_index" ON "partner_referral" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_referral_status_index" ON "partner_referral" USING btree ("status");