/**
 * Every plan limit and price lives here (build brief: "Keep all limits in lib/plans.ts").
 * Shared banks, mocks, practice and flashcards are unlimited on every plan.
 */

export type PlanName = "free" | "pro";

export type LimitedAction = "upload" | "ai_questions" | "tutor_message" | "theory_grading";

export interface PlanLimits {
  uploadsPerDay: number;
  pagesPerUpload: number;
  aiQuestionsPerDay: number;
  tutorMessagesPerDay: number;
  theoryGradingsPerDay: number;
  /** Higher runs first in the AI job queue. */
  queuePriority: number;
  studyPlan: "basic" | "full";
}

export const PLANS: Record<PlanName, PlanLimits> = {
  free: {
    uploadsPerDay: 2,
    pagesPerUpload: 20,
    aiQuestionsPerDay: 40,
    tutorMessagesPerDay: 10,
    theoryGradingsPerDay: 3,
    queuePriority: 0,
    studyPlan: "basic",
  },
  pro: {
    uploadsPerDay: 15,
    pagesPerUpload: 60,
    aiQuestionsPerDay: 400,
    tutorMessagesPerDay: 100,
    theoryGradingsPerDay: 30,
    queuePriority: 10,
    studyPlan: "full",
  },
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type PassProduct = "week" | "semester";

export interface Pass {
  product: PassProduct;
  name: string;
  amountKobo: number;
  days: number;
}

export const PASSES: Record<PassProduct, Pass> = {
  week: { product: "week", name: "Week Pass", amountKobo: 50_000, days: 7 },
  semester: { product: "semester", name: "Semester Pass", amountKobo: 200_000, days: 150 },
};

/** Invite this many classmates who sign up and finish a mock → reward. */
export const REFERRAL = { invitesNeeded: 3, rewardDays: 7 } as const;

/** What a paid pass unlocks — paywall checklist copy, derived from the limits above. */
export const PRO_UNLOCKS = [
  `${PLANS.pro.uploadsPerDay} uploads a day, ${PLANS.pro.pagesPerUpload} pages each`,
  `${PLANS.pro.tutorMessagesPerDay} tutor messages a day`,
  `${PLANS.pro.theoryGradingsPerDay} theory gradings a day`,
  "Skip the queue when it's busy",
] as const;

export function limitFor(plan: PlanName, action: LimitedAction): number {
  const p = PLANS[plan];
  switch (action) {
    case "upload":
      return p.uploadsPerDay;
    case "ai_questions":
      return p.aiQuestionsPerDay;
    case "tutor_message":
      return p.tutorMessagesPerDay;
    case "theory_grading":
      return p.theoryGradingsPerDay;
  }
}

export function remainingFor(plan: PlanName, action: LimitedAction, used: number): number {
  return Math.max(0, limitFor(plan, action) - used);
}

export function canUse(plan: PlanName, action: LimitedAction, used: number, amount = 1): boolean {
  return used + amount <= limitFor(plan, action);
}

export const ACTION_NOUN: Record<LimitedAction, [singular: string, plural: string]> = {
  upload: ["upload", "uploads"],
  ai_questions: ["AI question", "AI questions"],
  tutor_message: ["tutor message", "tutor messages"],
  theory_grading: ["theory grading", "theory gradings"],
};

export function planSummary(plan: PlanName): string {
  const p = PLANS[plan];
  return `${p.uploadsPerDay} uploads and ${p.aiQuestionsPerDay} AI questions a day`;
}

/** XP for turning notes into questions (design 2g), and for the first classmate who practises them (design 2e). */
export const UPLOAD_XP = 60;
export const CLASSMATE_XP = 50;
/** Most photos in one upload (each photo counts as a page against pagesPerUpload). */
export const MAX_PHOTOS = 30;
