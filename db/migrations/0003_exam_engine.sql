CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'auto_submitted');--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ALTER COLUMN "score" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ALTER COLUMN "max_score" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "mock_attempts" ALTER COLUMN "score" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "options" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
UPDATE "questions" SET "options" = '[]'::jsonb WHERE "options" IS NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "options" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "marks_awarded" real;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "client_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "answered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "option_order" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "status" "attempt_status" DEFAULT 'in_progress' NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "submit_reason" text;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "max_score" real;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "answered_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "current_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "client_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "late_answers" jsonb;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD COLUMN "xp_earned" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_label" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_rewards" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_attempts" ADD CONSTRAINT "mock_attempts_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mock_attempts_user_status_idx" ON "mock_attempts" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mock_attempts_challenge_user_idx" ON "mock_attempts" USING btree ("challenge_id","user_id");--> statement-breakpoint
-- Attempts finished before the engine existed count as submitted.
UPDATE "mock_attempts" SET "status" = 'submitted' WHERE "submitted_at" IS NOT NULL;
