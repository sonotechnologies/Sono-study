CREATE TABLE "card_review_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"flashcard_id" text NOT NULL,
	"course_id" text NOT NULL,
	"rating" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "created_by_id" text;--> statement-breakpoint
ALTER TABLE "tutor_messages" ADD COLUMN "citations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "card_review_log" ADD CONSTRAINT "card_review_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_review_log" ADD CONSTRAINT "card_review_log_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_review_log" ADD CONSTRAINT "card_review_log_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_review_log_user_idx" ON "card_review_log" USING btree ("user_id","reviewed_at");--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;