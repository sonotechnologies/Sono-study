/**
 * AI provider interface (ported from SonoCBT's lib/ai/provider.ts).
 * Only course material and question text are ever sent: never names, emails or scores.
 */
import type { z } from "zod";

export type AiPart = { text: string } | { image: { mimeType: string; base64: string } };

export type AiTask = "generate_questions" | "past_questions" | "flashcards" | "read_image" | "answer_from_notes" | "grade_theory" | "rubric";

export type AiRequest<T> = {
  task: AiTask;
  system: string;
  parts: AiPart[];
  /** Reply shape as an OpenAPI-subset schema (Gemini's responseSchema; described to other providers). */
  schema: Record<string, unknown>;
  /** Validates the reply. Invalid replies are retried once, then discarded. */
  parse: z.ZodType<T>;
  temperature?: number;
  /** Structured copy of the inputs. Real providers ignore it; the offline provider builds its reply from it. */
  context?: unknown;
};

export type EmbedKind = "document" | "query";

export interface AiProvider {
  readonly name: string;
  /** Can read photos. */
  readonly vision: boolean;
  generate<T>(req: AiRequest<T>): Promise<T>;
  /** 768-number vectors. Only providers in the same family may share a vector index. */
  embed?(texts: string[], kind: EmbedKind): Promise<number[][]>;
}

export type AiErrorKind =
  /** No provider configured. */
  | "not_configured"
  /** 429 / quota: cool this provider down and try the next. */
  | "limit"
  /** 5xx / overloaded: short cool-down, try the next. */
  | "busy"
  /** Every provider is cooling down: the job waits in the queue until retryAt. */
  | "cooldown"
  /** The reply never matched the schema (after one retry): discard. */
  | "invalid"
  /** The provider refused the content. */
  | "blocked"
  | "failed";

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: AiErrorKind = "failed",
    /** For limit/busy: how long the provider asked us to wait. For cooldown: when the first provider is back. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const EMBED_DIMENSIONS = 768;

/** Scales a vector to length 1 (truncated Gemini embeddings need it for cosine distance). */
export function normalise(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / len);
}
