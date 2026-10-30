ALTER TYPE "public"."payment_status" ADD VALUE 'claimed' BEFORE 'success';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "payment_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"title" text,
	"text" text NOT NULL,
	"is_credit" boolean NOT NULL,
	"amount_kobo" integer,
	"sender_name" text,
	"code" text,
	"payment_id" text,
	"dedupe_key" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_alerts_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "method" text DEFAULT 'paystack' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "transfer_amount_kobo" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "payment_alerts" ADD CONSTRAINT "payment_alerts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_alerts_received_idx" ON "payment_alerts" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "payments_transfer_idx" ON "payments" USING btree ("method","transfer_amount_kobo");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_code_unique" UNIQUE("code");