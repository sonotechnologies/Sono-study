ALTER TABLE "questions" ADD COLUMN "keep_option_order" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_messages" ADD COLUMN "cache_key" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "cards_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "tutor_messages_cache_idx" ON "tutor_messages" USING btree ("cache_key");