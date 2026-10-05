CREATE TABLE "billing_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"plan" text,
	"trial_ends_at" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone,
	"asaas_customer_id" text,
	"asaas_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_event" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"user_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_account" ADD CONSTRAINT "billing_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;