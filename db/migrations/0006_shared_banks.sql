CREATE TYPE "public"."report_reason" AS ENUM('wrong_answer', 'off_topic', 'copied', 'inappropriate');--> statement-breakpoint
ALTER TYPE "public"."question_status" ADD VALUE 'reported';--> statement-breakpoint
CREATE TABLE "bank_ratings" (
	"bank_id" text NOT NULL,
	"user_id" text NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_ratings_bank_id_user_id_pk" PRIMARY KEY("bank_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "question_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "readiness_snapshots" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"date" date NOT NULL,
	"score" real NOT NULL,
	CONSTRAINT "readiness_snapshots_user_id_course_id_date_pk" PRIMARY KEY("user_id","course_id","date")
);
--> statement-breakpoint
ALTER TABLE "banks" ADD COLUMN "upload_id" text;--> statement-breakpoint
ALTER TABLE "banks" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "banks" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_ratings" ADD CONSTRAINT "bank_ratings_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_ratings" ADD CONSTRAINT "bank_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_snapshots" ADD CONSTRAINT "readiness_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_snapshots" ADD CONSTRAINT "readiness_snapshots_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "question_reports_user_idx" ON "question_reports" USING btree ("question_id","user_id");--> statement-breakpoint
CREATE INDEX "question_reports_open_idx" ON "question_reports" USING btree ("resolved_at");--> statement-breakpoint
ALTER TABLE "banks" ADD CONSTRAINT "banks_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banks_course_idx" ON "banks" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "banks_upload_idx" ON "banks" USING btree ("upload_id");--> statement-breakpoint
-- Seeded sample papers are curated: show them as Verified.
UPDATE "banks" SET "verified" = true WHERE "owner_id" IS NULL;