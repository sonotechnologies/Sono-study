import { AiError, type AiProvider, type AiRequest } from "./provider";

/**
 * Groq free tier (OpenAI-compatible chat completions): the fallback when Gemini
 * is cooling down. JSON mode, with the reply schema spelt out in the prompt.
 * No embeddings; photos only if GROQ_VISION_MODEL is set.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

type Options = { fetch?: typeof fetch; visionModel?: string };

/** Gemini's OpenAPI-style schema ("OBJECT", nullable) → plain JSON Schema for the prompt. */
export function toJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "type" && typeof v === "string") out.type = v.toLowerCase();
    else if (k === "nullable") continue;
    else out[k] = toJsonSchema(v);
  }
  return out;
}

function retryAfter(res: Response): number {
  const s = Number.parseFloat(res.headers.get("retry-after") ?? "");
  return Number.isFinite(s) ? Math.max(5_000, s * 1000) : 60_000;
}

export function groqProvider(apiKey: string, model?: string, opts: Options = {}): AiProvider {
  const http = opts.fetch ?? fetch;
  const textModel = model || DEFAULT_GROQ_MODEL;
  return {
    name: "groq",
    vision: !!opts.visionModel,
    async generate<T>(req: AiRequest<T>): Promise<T> {
      const hasImage = req.parts.some((p) => "image" in p);
      if (hasImage && !opts.visionModel) throw new AiError("Groq is set up without a vision model.", "failed");
      const content = req.parts.map((p) =>
        "text" in p ? { type: "text", text: p.text } : { type: "image_url", image_url: { url: `data:${p.image.mimeType};base64,${p.image.base64}` } },
      );
      const body = JSON.stringify({
        model: hasImage ? opts.visionModel : textModel,
        temperature: req.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${req.system}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(toJsonSchema(req.schema))}`,
          },
          { role: "user", content: hasImage ? content : content.map((c) => (c as { text: string }).text).join("\n\n") },
        ],
      });

      let lastError = "The AI reply couldn't be read.";
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await http(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body,
        }).catch(() => null);
        if (!res) throw new AiError("Couldn't reach Groq.", "busy", 30_000);
        if (res.status === 429) throw new AiError("Groq free-tier limit reached.", "limit", retryAfter(res));
        if (res.status >= 500) throw new AiError("Groq is very busy right now.", "busy", 30_000);
        const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
        if (!res.ok) throw new AiError(`Groq refused the request: ${json.error?.message ?? res.status}`, "failed");
        const text = json.choices?.[0]?.message?.content ?? "";
        try {
          const parsed = req.parse.safeParse(JSON.parse(text));
          if (parsed.success) return parsed.data;
          lastError = "The AI reply was missing some fields.";
        } catch {
          lastError = "The AI reply wasn't valid JSON.";
        }
      }
      throw new AiError(lastError, "invalid");
    },
  };
}
