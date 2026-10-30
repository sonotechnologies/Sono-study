ALTER TABLE "enrollments" ADD COLUMN "exam_time" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "town" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "requested_by_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Students who already picked a school count as onboarded.
UPDATE "users" SET "onboarded_at" = now() WHERE "school_id" IS NOT NULL;
