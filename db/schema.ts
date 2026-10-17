import { relations, sql } from "drizzle-orm";
import type { AnswerKey, AttemptResponse, QuestionOption, QuestionSnapshot } from "@/lib/exam-engine/types";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const schoolType = pgEnum("school_type", ["university", "poly", "coe"]);
export const plan = pgEnum("plan", ["free", "pro"]);
export const uploadStatus = pgEnum("upload_status", ["queued", "extracting", "generating", "ready", "failed"]);
export const visibility = pgEnum("visibility", ["private", "shared"]);
export const uploadVisibility = pgEnum("upload_visibility", ["private", "contribute"]);
export const questionType = pgEnum("question_type", ["single", "multiple", "true_false", "fill_in", "theory"]);
/** hidden = removed by its author; reported = auto-hidden after 3 reports, pending admin review. */
export const questionStatus = pgEnum("question_status", ["active", "hidden", "reported"]);
export const reportReason = pgEnum("report_reason", ["wrong_answer", "off_topic", "copied", "inappropriate"]);
export const attemptMode = pgEnum("attempt_mode", ["mock", "practice", "challenge"]);
export const attemptStatus = pgEnum("attempt_status", ["in_progress", "submitted", "auto_submitted"]);
export const tutorRole = pgEnum("tutor_role", ["user", "assistant"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "done", "failed"]);
export const passProduct = pgEnum("pass_product", ["semester", "week"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "success", "failed"]);

// ── Schools & courses ────────────────────────────────────────────────────────

export const schools = pgTable("schools", {
  id: id(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  type: schoolType("type").notNull(),
  state: text("state").notNull(),
  town: text("town"),
  /** Added by a student from onboarding ("Can't find your school?") — pending review. */
  verified: boolean("verified").notNull().default(true),
  requestedById: text("requested_by_id"),
});

export const courses = pgTable(
  "courses",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** Normalised, e.g. GST101 — see lib/courses.ts normaliseCourseCode */
    code: text("code").notNull(),
    title: text("title").notNull(),
  },
  (t) => [uniqueIndex("courses_school_code_idx").on(t.schoolId, t.code)],
);

// ── Users & auth (Auth.js tables + product fields) ───────────────────────────

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: ts("email_verified"),
    image: text("image"),
    schoolId: text("school_id").references(() => schools.id),
    department: text("department"),
    level: integer("level"),
    plan: plan("plan").notNull().default("free"),
    proUntil: ts("pro_until"),
    streakDays: integer("streak_days").notNull().default(0),
    lastActiveDate: date("last_active_date"),
    xp: integer("xp").notNull().default(0),
    handle: text("handle").unique(),
    /** Leaderboards default to anonymous handles (privacy section of the brief). */
    anonymous: boolean("anonymous").notNull().default(true),
    referralCode: text("referral_code").unique(),
    referredById: text("referred_by_id"),
    /** Free Pro weeks already granted for referrals (one per REFERRAL.invitesNeeded). */
    referralRewards: integer("referral_rewards").notNull().default(0),
    notifyDailyReminder: boolean("notify_daily_reminder").notNull().default(true),
    reminderTime: text("reminder_time").notNull().default("20:00"),
    notifyStreak: boolean("notify_streak").notNull().default(true),
    notifyChallenge: boolean("notify_challenge").notNull().default(false),
    onboardedAt: ts("onboarded_at"),
    createdAt: createdAt(),
  },
  (t) => [index("users_school_dept_idx").on(t.schoolId, t.department)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: ts("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: ts("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    examDate: date("exam_date"),
    /** "09:00", Lagos time. */
    examTime: text("exam_time"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("enrollments_user_course_idx").on(t.userId, t.courseId)],
);

// ── Content ──────────────────────────────────────────────────────────────────

export const uploads = pgTable(
  "uploads",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    /** Storage key of the first file (files are private: never a public URL). */
    fileUrl: text("file_url").notNull(),
    /** Every stored file, in order (several for photos). */
    fileKeys: text("file_keys").array().notNull().default(sql`'{}'::text[]`),
    /** SHA-256 of the file (or of the photos' hashes, in order). Checked again on the server. */
    fileHash: text("file_hash").notNull(),
    /** pdf | pptx | docx | photos */
    type: text("type").notNull(),
    title: text("title").notNull().default("Notes"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    status: uploadStatus("status").notNull().default("queued"),
    /** Live "what's happening" line for the progress card. */
    statusLine: text("status_line"),
    error: text("error"),
    pageCount: integer("page_count"),
    /** Pages actually read (the plan caps pages per upload). */
    pagesUsed: integer("pages_used"),
    chunksTotal: integer("chunks_total").notNull().default(0),
    chunksDone: integer("chunks_done").notNull().default(0),
    /** AI questions this upload may still make (today's allowance when it was read). */
    questionBudget: integer("question_budget").notNull().default(0),
    questionsMade: integer("questions_made").notNull().default(0),
    flashcardsMade: integer("flashcards_made").notNull().default(0),
    isPastPaper: boolean("is_past_paper").notNull().default(false),
    /** Same file seen before: its questions and chunks were reused, no AI spent. */
    reusedFromId: text("reused_from_id"),
    xpEarned: integer("xp_earned").notNull().default(0),
    /** Set when a classmate first practises this upload's questions (+50 XP, once). */
    classmateXpAt: ts("classmate_xp_at"),
    visibility: uploadVisibility("visibility").notNull().default("contribute"),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("uploads_hash_idx").on(t.fileHash), index("uploads_user_idx").on(t.userId, t.createdAt)],
);

export const chunks = pgTable(
  "chunks",
  {
    id: id(),
    uploadId: text("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    text: text("text").notNull(),
    /** First page/slide/photo in this chunk, and a label for citations ("p.3–5", "slide 4"). */
    page: integer("page"),
    pageEnd: integer("page_end"),
    label: text("label"),
    topic: text("topic"),
    /** Questions this chunk should make; set when the upload is read. */
    questionTarget: integer("question_target").notNull().default(0),
    generatedAt: ts("generated_at"),
    embedding: vector("embedding", { dimensions: 768 }),
  },
  (t) => [index("chunks_upload_idx").on(t.uploadId)],
);

export const topics = pgTable(
  "topics",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [index("topics_course_idx").on(t.courseId)],
);

export const questions = pgTable(
  "questions",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    topicId: text("topic_id").references(() => topics.id),
    sourceUploadId: text("source_upload_id").references(() => uploads.id, { onDelete: "set null" }),
    /** Student who typed it in (manual entry); null for generated or seeded questions. */
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    type: questionType("type").notNull().default("single"),
    stem: text("stem").notNull(),
    /** Choice questions: options with stable ids (so shuffling and answers survive edits). */
    options: jsonb("options").$type<QuestionOption[]>().notNull().default([]),
    answer: jsonb("answer").$type<AnswerKey>().notNull(),
    explanation: text("explanation"),
    /** Where in the student's notes this comes from, e.g. "Week 2 slides · p.8". */
    sourceLabel: text("source_label"),
    difficulty: integer("difficulty").notNull().default(2),
    rubric: jsonb("rubric").$type<{ point: string; marks: number }[]>(),
    isPastQuestion: boolean("is_past_question").notNull().default(false),
    visibility: visibility("visibility").notNull().default("shared"),
    upvotes: integer("upvotes").notNull().default(0),
    reports: integer("reports").notNull().default(0),
    status: questionStatus("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("questions_course_topic_idx").on(t.courseId, t.topicId)],
);

export const banks = pgTable(
  "banks",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    /** The upload this bank was made from (one bank per upload). */
    uploadId: text("upload_id").references(() => uploads.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    questionIds: text("question_ids").array().notNull().default(sql`'{}'::text[]`),
    isShared: boolean("is_shared").notNull().default(true),
    /** Curated (seeded or checked by an admin): shows the "Verified" tag. */
    verified: boolean("verified").notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    /** Average of bank_ratings (1–5), null until rated. */
    rating: real("rating"),
    ratingCount: integer("rating_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("banks_course_idx").on(t.courseId), uniqueIndex("banks_upload_idx").on(t.uploadId)],
);

/** "Shared bank ratings" (brief §10): one 1–5 rating per student per bank, after taking it. */
export const bankRatings = pgTable(
  "bank_ratings",
  {
    bankId: text("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.bankId, t.userId] })],
);

/** "Report question" (brief: content safety). One report per student per question; 3 auto-hide it. */
export const questionReports = pgTable(
  "question_reports",
  {
    id: id(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: reportReason("reason").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
    /** restored | removed | edited */
    resolution: text("resolution"),
  },
  (t) => [uniqueIndex("question_reports_user_idx").on(t.questionId, t.userId), index("question_reports_open_idx").on(t.resolvedAt)],
);

/** Readiness per course per Lagos day, so "+6% this week" compares like with like. */
export const readinessSnapshots = pgTable(
  "readiness_snapshots",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    score: real("score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId, t.date] })],
);

// ── Exam engine ──────────────────────────────────────────────────────────────

export type AttemptConfig = {
  count: number;
  /** null = untimed */
  timeLimitSec: number | null;
  topicIds: string[];
  difficulty: "mixed" | "easier" | "harder";
  bankId: string | null;
  /** Only questions made from this upload (the "ready" screen's mock and practice). */
  uploadId?: string | null;
};

export type LateAnswer = { questionId: string; response: AttemptResponse | null; clientSeq: number; receivedAt: string };

export const mockAttempts = pgTable(
  "mock_attempts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    bankId: text("bank_id").references(() => banks.id),
    challengeId: text("challenge_id").references(() => challenges.id, { onDelete: "set null" }),
    questionIds: text("question_ids").array().notNull(),
    /** Questions frozen at start (answer keys included) — server only. */
    snapshot: jsonb("snapshot").$type<QuestionSnapshot[]>().notNull().default([]),
    optionOrder: jsonb("option_order").$type<Record<string, string[]>>().notNull().default({}),
    config: jsonb("config").$type<AttemptConfig>(),
    durationSec: integer("duration_sec"),
    startedAt: ts("started_at").notNull().defaultNow(),
    /** Server-side end time is final. null = untimed (practice). */
    endsAt: ts("ends_at"),
    submittedAt: ts("submitted_at"),
    status: attemptStatus("status").notNull().default("in_progress"),
    submitReason: text("submit_reason").$type<"student" | "timeout">(),
    score: real("score"),
    maxScore: real("max_score"),
    answeredCount: integer("answered_count").notNull().default(0),
    currentIndex: integer("current_index").notNull().default(0),
    /** Highest device sequence number applied. */
    clientSeq: integer("client_seq").notNull().default(0),
    lastSeenAt: ts("last_seen_at"),
    lateAnswers: jsonb("late_answers").$type<LateAnswer[]>(),
    xpEarned: integer("xp_earned"),
    mode: attemptMode("mode").notNull().default("mock"),
  },
  (t) => [
    index("mock_attempts_user_course_idx").on(t.userId, t.courseId),
    index("mock_attempts_user_status_idx").on(t.userId, t.status),
    uniqueIndex("mock_attempts_challenge_user_idx").on(t.challengeId, t.userId),
  ],
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: id(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => mockAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id),
    answer: jsonb("answer").$type<AttemptResponse | null>(),
    isCorrect: boolean("is_correct"),
    marksAwarded: real("marks_awarded"),
    flagged: boolean("flagged").notNull().default(false),
    timeSpentSec: integer("time_spent_sec").notNull().default(0),
    clientSeq: integer("client_seq").notNull().default(0),
    answeredAt: ts("answered_at"),
  },
  (t) => [uniqueIndex("attempt_answers_attempt_question_idx").on(t.attemptId, t.questionId)],
);

export const topicMastery = pgTable(
  "topic_mastery",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    correct: integer("correct").notNull().default(0),
    total: integer("total").notNull().default(0),
    masteryScore: real("mastery_score").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] })],
);

// ── Flashcards, tutor, theory ────────────────────────────────────────────────

export const flashcards = pgTable("flashcards", {
  id: id(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  topicId: text("topic_id").references(() => topics.id),
  front: text("front").notNull(),
  back: text("back").notNull(),
  sourceUploadId: text("source_upload_id").references(() => uploads.id, { onDelete: "set null" }),
  sourceLabel: text("source_label"),
  visibility: visibility("visibility").notNull().default("shared"),
  createdAt: createdAt(),
});

export const cardReviews = pgTable(
  "card_reviews",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    ease: real("ease").notNull().default(2.5),
    intervalDays: real("interval_days").notNull().default(0),
    dueAt: ts("due_at").notNull().defaultNow(),
    lapses: integer("lapses").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.flashcardId] }), index("card_reviews_due_idx").on(t.userId, t.dueAt)],
);

export const tutorMessages = pgTable("tutor_messages", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  role: tutorRole("role").notNull(),
  content: text("content").notNull(),
  citedChunkIds: text("cited_chunk_ids").array().notNull().default(sql`'{}'::text[]`),
  createdAt: createdAt(),
});

export const theoryAttempts = pgTable("theory_attempts", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id),
  answerText: text("answer_text").notNull(),
  score: real("score"),
  maxScore: real("max_score"),
  feedback: jsonb("feedback"),
  createdAt: createdAt(),
});

// ── Social ───────────────────────────────────────────────────────────────────

export const challenges = pgTable(
  "challenges",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    bankId: text("bank_id").references(() => banks.id),
    title: text("title").notNull(),
    questionCount: integer("question_count").notNull(),
    durationSec: integer("duration_sec").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("challenges_course_idx").on(t.courseId, t.startsAt)],
);

/** "Join · remind me" — who signed up for a challenge reminder. */
export const challengeSignups = pgTable(
  "challenge_signups",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.userId] })],
);

/**
 * One row per user per course-week (challengeId null) or per challenge.
 * Holds the user's best result; ranked by score ratio, then time.
 */
export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    weekStart: date("week_start"),
    challengeId: text("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    maxScore: real("max_score").notNull(),
    timeSec: integer("time_sec").notNull(),
    mocks: integer("mocks").notNull().default(1),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leaderboard_week_user_idx").on(t.courseId, t.weekStart, t.userId),
    uniqueIndex("leaderboard_challenge_user_idx").on(t.challengeId, t.userId),
  ],
);

// ── Infra ────────────────────────────────────────────────────────────────────

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: id(),
    type: text("type").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    provider: text("provider"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: ts("run_after").notNull().defaultNow(),
    /** When a worker claimed it; a running job older than the lease is reclaimed. */
    lockedAt: ts("locked_at"),
    finishedAt: ts("finished_at"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_jobs_queue_idx").on(t.status, t.priority, t.runAfter)],
);

/** Free-tier providers that hit a limit rest until cooldownUntil; the queue waits for the first to recover. */
export const aiProviders = pgTable("ai_providers", {
  name: text("name").primaryKey(),
  cooldownUntil: ts("cooldown_until"),
  lastError: text("last_error"),
  calls: integer("calls").notNull().default(0),
  failures: integer("failures").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    action: text("action").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.action] })],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reference: text("reference").notNull().unique(),
    product: passProduct("product").notNull(),
    amountKobo: integer("amount_kobo").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
  },
  (t) => [index("payments_user_idx").on(t.userId)],
);

// ── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, { fields: [users.schoolId], references: [schools.id] }),
  enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  school: one(schools, { fields: [courses.schoolId], references: [schools.id] }),
  enrollments: many(enrollments),
}));

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type School = typeof schools.$inferSelect;
export type MockAttempt = typeof mockAttempts.$inferSelect;
export type Question = typeof questions.$inferSelect;
