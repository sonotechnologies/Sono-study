import { count, eq, inArray } from "drizzle-orm";
import type { Db } from "../index";
import { banks, courses, questions, topics } from "../schema";
import type { AnswerKey } from "../../lib/exam-engine/types";
import { CHM101 } from "./chm101";
import { GST111 } from "./gst111";
import { MAC111 } from "./mac111";
import { MTH101 } from "./mth101";
import { PHY101 } from "./phy101";
import type { BankQuestion } from "./types";

/** Course code → sample questions. 5 courses × 60 = 300 (brief: seed data doubles as the portfolio demo). */
export const QUESTION_BANK: Record<string, BankQuestion[]> = { GST111, MTH101, CHM101, MAC111, PHY101 };

const IDS = ["a", "b", "c", "d", "e", "f"];

/** Turns an authored question into a row. Throws on authoring mistakes so a bad bank never ships. */
export function toRow(q: BankQuestion, where: string): { type: "single" | "multiple" | "true_false" | "fill_in"; options: { id: string; text: string }[]; answer: AnswerKey } {
  const fail = (msg: string) => {
    throw new Error(`${where}: ${msg}`);
  };
  if (!q.stem.trim() || !q.why.trim()) fail("missing stem or explanation");
  switch (q.t) {
    case "single":
    case "multiple": {
      if (q.options.length < 2 || q.options.length > IDS.length) fail("needs 2–6 options");
      if (new Set(q.options).size !== q.options.length) fail("duplicate options");
      const options = q.options.map((text, i) => ({ id: IDS[i], text }));
      if (q.t === "single") {
        if (!(q.correct >= 0 && q.correct < q.options.length)) fail("correct option out of range");
        return { type: "single", options, answer: { kind: "single", correct: IDS[q.correct] } };
      }
      if (!q.correct.length || q.correct.some((c) => !(c >= 0 && c < q.options.length))) fail("correct options out of range");
      return { type: "multiple", options, answer: { kind: "multiple", correct: q.correct.map((c) => IDS[c]), scoring: "all_or_nothing" } };
    }
    case "true_false":
      return { type: "true_false", options: [], answer: { kind: "true_false", correct: q.correct } };
    case "fill_in":
      if (!q.accepted.length) fail("no accepted answers");
      return { type: "fill_in", options: [], answer: { kind: "fill_in", accepted: q.accepted, caseSensitive: false } };
  }
}

/** Adds the sample questions (and one shared sample bank) to every seeded course that has none yet. */
export async function ensureQuestionBank(db: Db) {
  const codes = Object.keys(QUESTION_BANK);
  const targets = await db.select({ id: courses.id, code: courses.code }).from(courses).where(inArray(courses.code, codes));
  for (const course of targets) {
    const [{ n }] = await db.select({ n: count() }).from(questions).where(eq(questions.courseId, course.id));
    if (Number(n) > 0) continue;
    const bank = QUESTION_BANK[course.code];
    const topicNames = [...new Set(bank.map((q) => q.topic))];
    const topicRows = await db
      .insert(topics)
      .values(topicNames.map((name) => ({ courseId: course.id, name })))
      .returning({ id: topics.id, name: topics.name });
    const topicId = new Map(topicRows.map((t) => [t.name, t.id]));
    const inserted = await db
      .insert(questions)
      .values(
        bank.map((q, i) => ({
          courseId: course.id,
          topicId: topicId.get(q.topic)!,
          ...toRow(q, `${course.code} #${i + 1}`),
          stem: q.stem,
          explanation: q.why,
          difficulty: q.d,
          visibility: "shared" as const,
          isPastQuestion: false,
        })),
      )
      .returning({ id: questions.id });
    // A shared 30-question paper for "Pick a bank": every other question, spread across topics.
    const label = course.code.replace(/^([A-Z]+)(\d+)/, "$1 $2");
    await db.insert(banks).values({
      courseId: course.id,
      ownerId: null,
      title: `${label} sample paper`,
      questionIds: inserted.filter((_, i) => i % 2 === 0).map((r) => r.id),
      isShared: true,
    });
  }
}
