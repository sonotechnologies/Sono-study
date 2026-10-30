import { inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiProviders } from "@/db/schema";
import { fakeProvider } from "./fake";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { AiError, type AiProvider, type EmbedKind } from "./provider";
import * as tasks from "./tasks";

export { AiError } from "./provider";
export type { AiProvider } from "./provider";

/**
 * The one `ai` adapter (build brief: "AI on free tiers"). Providers come from the
 * environment and are tried in order: Gemini, then Groq, then anything added later.
 * A provider that hits a 429/quota is cooled down in the database for the window it
 * asked for, so every worker skips it; when all are cooling down the caller gets a
 * "cooldown" error with the time the first one is back, and the job waits in the queue.
 */

let testProviders: AiProvider[] | null = null;
/** Tests swap in their own providers. */
export function setAiProvidersForTests(list: AiProvider[] | null) {
  testProviders = list;
}

/** Wraps a provider so it always fails like an exhausted free tier (AI_FORCE_FAIL, for failover checks). */
export function failingProvider(p: AiProvider): AiProvider {
  const fail = async (): Promise<never> => {
    throw new AiError(`${p.name} forced to fail (AI_FORCE_FAIL).`, "limit", 60_000);
  };
  return { name: p.name, vision: p.vision, generate: fail, ...(p.embed ? { embed: fail } : {}) };
}

export function configuredProviders(env: NodeJS.ProcessEnv = process.env): AiProvider[] {
  if (testProviders) return testProviders;
  const order = (env.AI_PROVIDERS ?? "gemini,groq")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const list: AiProvider[] = [];
  for (const name of order) {
    if (name === "gemini" && env.GEMINI_API_KEY) list.push(geminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL, { embedModel: env.GEMINI_EMBED_MODEL }));
    else if (name === "groq" && env.GROQ_API_KEY) list.push(groqProvider(env.GROQ_API_KEY, env.GROQ_MODEL, { visionModel: env.GROQ_VISION_MODEL }));
    else if (name.startsWith("fake")) list.push(fakeProvider(name));
  }
  // Development without keys: the offline provider, so the whole pipeline still runs.
  if (!list.length && env.NODE_ENV !== "production") list.push(fakeProvider("fake"));
  const forced = new Set((env.AI_FORCE_FAIL ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return list.map((p) => (forced.has(p.name) ? failingProvider(p) : p));
}

export function aiConfigured(): boolean {
  return configuredProviders().length > 0;
}

export type Capability = "text" | "vision" | "embed";

const supports = (p: AiProvider, need: Capability) => (need === "vision" ? p.vision : need === "embed" ? !!p.embed : true);

async function cooldowns(db: Db, names: string[]): Promise<Map<string, Date>> {
  if (!names.length) return new Map();
  const rows = await db.select({ name: aiProviders.name, until: aiProviders.cooldownUntil }).from(aiProviders).where(inArray(aiProviders.name, names));
  return new Map(rows.filter((r) => r.until).map((r) => [r.name, r.until!]));
}

async function note(db: Db, name: string, patch: { cooldownUntil?: Date | null; lastError?: string | null; failed: boolean }) {
  const now = new Date();
  await db
    .insert(aiProviders)
    .values({ name, cooldownUntil: patch.cooldownUntil ?? null, lastError: patch.lastError ?? null, calls: 1, failures: patch.failed ? 1 : 0, updatedAt: now })
    .onConflictDoUpdate({
      target: aiProviders.name,
      set: {
        calls: sql`${aiProviders.calls} + 1`,
        failures: sql`${aiProviders.failures} + ${patch.failed ? 1 : 0}`,
        updatedAt: now,
        ...(patch.cooldownUntil !== undefined ? { cooldownUntil: patch.cooldownUntil } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
      },
    });
}

/** When the first cooling provider for this capability is back (null = one is free now, or none exist). */
export async function nextProviderAt(db: Db, need: Capability = "text", now = new Date()): Promise<Date | null> {
  const list = configuredProviders().filter((p) => supports(p, need));
  if (!list.length) return null;
  const cool = await cooldowns(db, list.map((p) => p.name));
  const waits = list.map((p) => cool.get(p.name)).map((d) => (d && d > now ? d : null));
  if (waits.some((d) => d === null)) return null;
  return new Date(Math.min(...waits.map((d) => d!.getTime())));
}

/**
 * Runs fn on the first provider that can do it, falling back down the list.
 * Limits and outages cool a provider down; refusals and invalid output stop
 * (another provider wouldn't make the material any clearer).
 */
export async function withAi<T>(db: Db, need: Capability, fn: (p: AiProvider) => Promise<T>, now = new Date()): Promise<{ value: T; provider: string }> {
  const list = configuredProviders().filter((p) => supports(p, need));
  if (!list.length) throw new AiError("AI isn't set up yet. Add GEMINI_API_KEY (and optionally GROQ_API_KEY).", "not_configured");
  const cool = await cooldowns(db, list.map((p) => p.name));
  let lastError: AiError | null = null;
  let tried = 0;
  for (const p of list) {
    const until = cool.get(p.name);
    if (until && until > now) continue;
    tried++;
    try {
      const value = await fn(p);
      await note(db, p.name, { cooldownUntil: null, failed: false });
      return { value, provider: p.name };
    } catch (err) {
      const e = err instanceof AiError ? err : new AiError((err as Error)?.message ?? "AI call failed.", "failed");
      if (e.kind === "limit" || e.kind === "busy") {
        const until = new Date(now.getTime() + (e.retryAfterMs ?? (e.kind === "limit" ? 60_000 : 30_000)));
        cool.set(p.name, until);
        await note(db, p.name, { cooldownUntil: until, lastError: e.message, failed: true });
        lastError = e;
        continue;
      }
      await note(db, p.name, { lastError: e.message, failed: true });
      if (e.kind === "failed") {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  const waits = list.map((p) => cool.get(p.name)).filter((d): d is Date => !!d && d > now);
  if (waits.length === list.length || (tried === 0 && waits.length)) {
    const first = Math.min(...waits.map((d) => d.getTime()));
    throw new AiError("Every AI provider is resting. The job will wait in the queue.", "cooldown", Math.max(1_000, first - now.getTime()));
  }
  throw lastError ?? new AiError("AI call failed.", "failed");
}

/** The adapter's interface (build brief): every call goes through the fallback chain. */
export const ai = {
  generateQuestions: (db: Db, input: tasks.GenerateInput) => withAi(db, "text", (p) => tasks.generateQuestions(p, input)),
  extractPastQuestions: (db: Db, input: tasks.PastPaperInput) => withAi(db, "text", (p) => tasks.extractPastQuestions(p, input)),
  generateFlashcards: (db: Db, input: Parameters<typeof tasks.generateFlashcards>[1]) => withAi(db, "text", (p) => tasks.generateFlashcards(p, input)),
  readImage: (db: Db, input: Parameters<typeof tasks.readImage>[1]) => withAi(db, "vision", (p) => tasks.readImage(p, input)),
  answerFromNotes: (db: Db, input: Parameters<typeof tasks.answerFromNotes>[1]) => withAi(db, "text", (p) => tasks.answerFromNotes(p, input)),
  gradeTheory: (db: Db, input: Parameters<typeof tasks.gradeTheory>[1]) => withAi(db, "text", (p) => tasks.gradeTheory(p, input)),
  generateRubric: (db: Db, input: Parameters<typeof tasks.generateRubric>[1]) => withAi(db, "text", (p) => tasks.generateRubric(p, input)),
  embed: (db: Db, texts: string[], kind: EmbedKind = "document") => withAi(db, "embed", (p) => p.embed!(texts, kind)),
};
