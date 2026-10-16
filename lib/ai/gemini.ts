import { AiError, EMBED_DIMENSIONS, normalise, type AiProvider, type AiRequest, type EmbedKind } from "./provider";

/**
 * Google Gemini, free tier (ported from SonoCBT's lib/ai/gemini.ts).
 * Structured JSON output validated with Zod. A model that is out of quota (429)
 * or retired (404) hands over to the next model in the list; when every model is
 * out of quota the provider reports a limit with Google's suggested wait, so the
 * router can cool it down and move on to the next provider.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
export const DEFAULT_EMBED_MODEL = "gemini-embedding-001";

type GeminiError = { message?: string; status?: string; details?: { "@type"?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[] };
type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: GeminiError;
};

type Options = { wait?: (ms: number) => Promise<void>; fetch?: typeof fetch; embedModel?: string };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** "a, b" → ["a", "b"]. Empty → the defaults. */
export function parseModels(value: string | string[] | undefined): string[] {
  const list = (Array.isArray(value) ? value : (value ?? "").split(",")).map((m) => m.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

/** How long Google asks us to wait after a 429: its RetryInfo, or an hour for a daily quota. */
export function retryAfterMs(err: GeminiError | undefined): number {
  const details = err?.details ?? [];
  if (details.some((d) => d.violations?.some((v) => /per ?day/i.test(v.quotaId ?? "")))) return 60 * 60_000;
  const delay = details.find((d) => d.retryDelay)?.retryDelay;
  const seconds = delay ? Number.parseFloat(delay) : NaN;
  return Number.isFinite(seconds) ? Math.max(5_000, Math.ceil(seconds * 1000)) : 60_000;
}

export function geminiProvider(apiKey: string, models?: string | string[], opts: Options = {}): AiProvider {
  const list = parseModels(models);
  const wait = opts.wait ?? sleep;
  const http = opts.fetch ?? fetch;
  const embedModel = opts.embedModel || DEFAULT_EMBED_MODEL;

  return {
    name: "gemini",
    vision: true,
    async generate<T>(req: AiRequest<T>): Promise<T> {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [
          {
            role: "user",
            parts: req.parts.map((p) => ("text" in p ? { text: p.text } : { inlineData: { mimeType: p.image.mimeType, data: p.image.base64 } })),
          },
        ],
        generationConfig: { responseMimeType: "application/json", responseSchema: req.schema, temperature: req.temperature ?? 0.2 },
      });

      let busy = false;
      let limitedFor: number | null = null;
      let lastError = "The AI reply couldn't be read.";
      let invalid = false;
      for (const model of list) {
        let badReplies = 0;
        for (let attempt = 0; attempt < 2; attempt++) {
          let res: Response;
          try {
            res = await http(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body,
            });
          } catch {
            busy = true;
            if (attempt === 0) await wait(1500);
            continue;
          }
          const json = (await res.json().catch(() => ({}))) as GeminiResponse;
          if (res.status === 429) {
            const ms = retryAfterMs(json.error);
            limitedFor = limitedFor === null ? ms : Math.min(limitedFor, ms);
            break; // quota is per model: try the next one
          }
          if (res.status === 404) break; // model retired for this key
          if (res.status === 400 || res.status === 403) {
            throw new AiError(`Gemini refused the request: ${json.error?.message ?? res.status}`, "failed");
          }
          if (res.status >= 500) {
            busy = true;
            if (attempt === 0) await wait(1500);
            continue;
          }
          if (!res.ok) {
            lastError = `Gemini had a problem (${res.status}).`;
            break;
          }
          if (json.promptFeedback?.blockReason) throw new AiError("The AI declined to read this. Try clearer pages.", "blocked");
          const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
          try {
            const parsed = req.parse.safeParse(JSON.parse(text));
            if (parsed.success) return parsed.data;
            lastError = "The AI reply was missing some fields.";
          } catch {
            lastError = "The AI reply wasn't valid JSON.";
          }
          invalid = true;
          if (++badReplies >= 2) break;
        }
        if (invalid && badReplies >= 2) throw new AiError(lastError, "invalid");
      }
      if (limitedFor !== null) throw new AiError("Gemini free-tier limit reached.", "limit", limitedFor);
      if (busy) throw new AiError("Gemini is very busy right now.", "busy", 30_000);
      throw new AiError(lastError, invalid ? "invalid" : "failed");
    },

    async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
      const out: number[][] = [];
      // batchEmbedContents takes up to 100 texts per call.
      for (let i = 0; i < texts.length; i += 100) {
        const batch = texts.slice(i, i + 100);
        const res = await http(`${ENDPOINT}/${encodeURIComponent(embedModel)}:batchEmbedContents`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${embedModel}`,
              content: { parts: [{ text: text.slice(0, 8000) }] },
              taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
              outputDimensionality: EMBED_DIMENSIONS,
            })),
          }),
        }).catch(() => null);
        if (!res) throw new AiError("Couldn't reach Gemini.", "busy", 30_000);
        const json = (await res.json().catch(() => ({}))) as { embeddings?: { values?: number[] }[]; error?: GeminiError };
        if (res.status === 429) throw new AiError("Gemini embedding limit reached.", "limit", retryAfterMs(json.error));
        if (res.status >= 500) throw new AiError("Gemini is very busy right now.", "busy", 30_000);
        if (!res.ok) throw new AiError(`Gemini couldn't embed the notes (${res.status}).`, "failed");
        const vectors = (json.embeddings ?? []).map((e) => e.values ?? []);
        if (vectors.length !== batch.length || vectors.some((v) => v.length !== EMBED_DIMENSIONS)) {
          throw new AiError("Gemini returned embeddings of the wrong size.", "invalid");
        }
        out.push(...vectors.map(normalise));
      }
      return out;
    },
  };
}
