CREATE TABLE "ai_providers" (
	"name" text PRIMARY KEY NOT NULL,
	"cooldown_until" timestamp with time zone,
	"last_error" text,
	"calls" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "uploads_user_idx";--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "page_end" integer;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "question_target" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "source_label" text;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "file_keys" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "title" text DEFAULT 'Notes' NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "size_bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "status_line" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "pages_used" integer;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "chunks_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "chunks_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "question_budget" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "questions_made" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "flashcards_made" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "is_past_paper" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "reused_from_id" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "xp_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "classmate_xp_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "uploads_user_idx" ON "uploads" USING btree ("user_id","created_at");