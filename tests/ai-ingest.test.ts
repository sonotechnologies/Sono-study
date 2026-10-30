import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { z } from "zod";
import { geminiProvider, retryAfterMs } from "@/lib/ai/gemini";
import { groqProvider, toJsonSchema } from "@/lib/ai/groq";
import { looksLikePastPaper, toBankQuestion, type GeneratedQuestion } from "@/lib/ai/tasks";
import { chunkPages, questionTargets, rangeLabel } from "@/lib/ingest/chunk";
import { extractDocument, extractOffice, splitSections, tooLittleText } from "@/lib/ingest/extract";
import { headingOf, matchTopic, similarity, tidyTopic } from "@/lib/ingest/topics";
import { makeNotesPdf } from "./fixtures/notes";

const req = { task: "flashcards" as const, system: "s", parts: [{ text: "hi" }], schema: { type: "OBJECT" }, parse: z.object({ ok: z.boolean() }) };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const reply = (text: string) => json(200, { candidates: [{ content: { parts: [{ text }] } }] });

describe("Gemini adapter", () => {
  it("tries the next model when one is out of quota", async () => {
    const seen: string[] = [];
    const fetch = (async (url: string) => {
      seen.push(url);
      return url.includes("model-a") ? json(429, { error: { details: [{ retryDelay: "12s" }] } }) : reply('{"ok":true}');
    }) as unknown as typeof globalThis.fetch;
    const p = geminiProvider("k", "model-a,model-b", { fetch, wait: async () => {} });
    expect(await p.generate(req)).toEqual({ ok: true });
    expect(seen.map((u) => u.match(/model-[ab]/)![0])).toEqual(["model-a", "model-b"]);
  });

  it("reports a limit with Google's retry delay when every model is out of quota", async () => {
    const fetch = (async () => json(429, { error: { details: [{ retryDelay: "37s" }] } })) as unknown as typeof globalThis.fetch;
    const p = geminiProvider("k", "a,b", { fetch, wait: async () => {} });
    await expect(p.generate(req)).rejects.toMatchObject({ kind: "limit", retryAfterMs: 37_000 });
  });

  it("treats a daily quota as an hour's cool-down", () => {
    expect(retryAfterMs({ details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] })).toBe(3_600_000);
    expect(retryAfterMs(undefined)).toBe(60_000);
  });

  it("retries an invalid reply once, then gives up as invalid", async () => {
    let n = 0;
    const fetch = (async () => (n++, reply('{"nope":1}'))) as unknown as typeof globalThis.fetch;
    const p = geminiProvider("k", "only", { fetch, wait: async () => {} });
    await expect(p.generate(req)).rejects.toMatchObject({ kind: "invalid" });
    expect(n).toBe(2);
  });

  it("embeds in 768 dimensions, normalised", async () => {
    const fetch = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.requests[0].outputDimensionality).toBe(768);
      return json(200, { embeddings: body.requests.map(() => ({ values: Array.from({ length: 768 }, () => 2) })) });
    }) as unknown as typeof globalThis.fetch;
    const [v] = await geminiProvider("k", undefined, { fetch }).embed!(["a"], "document");
    expect(v).toHaveLength(768);
    expect(Math.hypot(...v)).toBeCloseTo(1, 6);
  });
});

describe("Groq adapter", () => {
  it("describes Gemini's schema as JSON Schema", () => {
    expect(toJsonSchema({ type: "OBJECT", properties: { a: { type: "STRING", nullable: true } } })).toEqual({ type: "object", properties: { a: { type: "string" } } });
  });

  it("maps 429 to a limit using Retry-After", async () => {
    const fetch = (async () => json(429, {}, { "retry-after": "20" })) as unknown as typeof globalThis.fetch;
    await expect(groqProvider("k", undefined, { fetch }).generate(req)).rejects.toMatchObject({ kind: "limit", retryAfterMs: 20_000 });
  });

  it("parses JSON mode replies", async () => {
    const fetch = (async () => json(200, { choices: [{ message: { content: '{"ok":true}' } }] })) as unknown as typeof globalThis.fetch;
    expect(await groqProvider("k", undefined, { fetch }).generate(req)).toEqual({ ok: true });
  });
});

describe("generated questions", () => {
  const base: GeneratedQuestion = { type: "single", topic: "Concord", stem: "Which verb agrees with 'The team'?", options: ["A. is", "B. are", "C. were", "D. be"], correct: [0], answer: "", explanation: "Collective nouns acting as one take a singular verb.", difficulty: "medium" };

  it("keeps good questions and strips option letters", () => {
    expect(toBankQuestion(base, "x")).toMatchObject({ t: "single", options: ["is", "are", "were", "be"], correct: 0, d: 2 });
  });

  it("drops broken ones", () => {
    expect(toBankQuestion({ ...base, correct: [7] }, "x")).toBeNull();
    expect(toBankQuestion({ ...base, options: ["is", "is", "are", "be"] }, "x")).toBeNull();
    expect(toBankQuestion({ ...base, explanation: "" }, "x")).toBeNull();
    expect(toBankQuestion({ ...base, type: "true_false", options: [], correct: [], answer: "maybe" }, "x")).toBeNull();
  });

  it("handles every type", () => {
    expect(toBankQuestion({ ...base, type: "multiple", correct: [0, 2] }, "x")).toMatchObject({ t: "multiple", correct: [0, 2] });
    expect(toBankQuestion({ ...base, type: "multiple", correct: [1] }, "x")).toMatchObject({ t: "single", correct: 1 });
    expect(toBankQuestion({ ...base, type: "true_false", answer: "False" }, "x")).toMatchObject({ t: "true_false", correct: false });
    expect(toBankQuestion({ ...base, type: "fill_in", answer: "is | Is" }, "x")).toMatchObject({ t: "fill_in", accepted: ["is", "Is"] });
  });

  it("spots past-question papers", () => {
    const paper = `UNIVERSITY OF LAGOS\nFirst Semester Examination 2024/2025\nInstructions: Answer all questions. Time allowed: 1 hour\n${Array.from(
      { length: 6 },
      (_, i) => `${i + 1}. Which of these is a noun?\nA. run\nB. Lagos\nC. quickly\nD. and`,
    ).join("\n")}`;
    expect(looksLikePastPaper(paper)).toBe(true);
    expect(looksLikePastPaper("Barriers to communication\nNoise is any interference that distorts a message.")).toBe(false);
  });
});

describe("chunking and topics", () => {
  const page = (n: number, chars: number) => ({ n, label: `p.${n}`, text: `Heading ${n}\n` + "word ".repeat(chars / 5) });

  it("merges pages into ~6,000-character chunks with page ranges", () => {
    const chunks = chunkPages(Array.from({ length: 20 }, (_, i) => page(i + 1, 1500)));
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks[0]).toMatchObject({ page: 1, label: "p.1–3" });
    expect(chunks.at(-1)!.pageEnd).toBe(20);
  });

  it("labels slides and sections", () => {
    expect(rangeLabel({ n: 3, label: "slide 3", text: "" }, { n: 5, label: "slide 5", text: "" })).toBe("slides 3–5");
    expect(rangeLabel({ n: 4, label: "p.4", text: "" }, { n: 4, label: "p.4", text: "" })).toBe("p.4");
  });

  it("shares the AI allowance across chunks", () => {
    const t = questionTargets([{ text: "x".repeat(6000) }, { text: "x".repeat(6000) }, { text: "x".repeat(2000) }], 40);
    expect(t.reduce((a, b) => a + b, 0)).toBe(40);
    expect(questionTargets([{ text: "x".repeat(6000) }], 100)).toEqual([20]);
    expect(questionTargets([{ text: "x" }], 0)).toEqual([0]);
  });

  it("merges near-duplicate topic names", () => {
    const known = [{ name: "Barriers to communication" }, { name: "Listening skills" }];
    expect(matchTopic("Communication barriers", known)?.name).toBe("Barriers to communication");
    expect(matchTopic("barriers to communication.", known)?.name).toBe("Barriers to communication");
    expect(matchTopic("Listening skill", known)?.name).toBe("Listening skills");
    expect(matchTopic("Essay writing", known)).toBeNull();
    expect(similarity("abc", "abc")).toBe(1);
    expect(tidyTopic("3. concord rules:")).toBe("Concord rules");
    expect(headingOf("[p.3]\nConcord\nThe verb agrees.")).toBe("Concord");
  });
});

/** Smallest valid PowerPoint: two slides of text. */
async function makePptx(): Promise<Uint8Array> {
  const zip = new JSZip();
  const slide = (t: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
  );
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`,
  );
  zip.file("ppt/slides/slide1.xml", slide("Noise is any interference that distorts a message."));
  zip.file("ppt/slides/slide2.xml", slide("Feedback shows the speaker how the message was received."));
  return zip.generateAsync({ type: "uint8array" });
}

describe("extraction", () => {
  it("reads PDFs page by page and caps pages", async () => {
    const pdf = await makeNotesPdf(6);
    const all = await extractDocument(pdf, "pdf", 60);
    expect(all.pageCount).toBe(6);
    expect(all.pages[0]).toMatchObject({ n: 1, label: "p.1" });
    expect(all.pages[0].text).toContain("Barriers to communication");
    const capped = await extractDocument(pdf, "pdf", 2);
    expect(capped.pages).toHaveLength(2);
    expect(capped.pageCount).toBe(6);
    expect(tooLittleText(all.pages)).toBe(false);
  });

  it("reads PowerPoint slides with slide numbers", async () => {
    const out = await extractOffice(await makePptx(), "pptx", 60);
    expect(out.pages.map((p) => p.label)).toEqual(["slide 1", "slide 2"]);
    expect(out.pages[1].text).toContain("Feedback");
  });

  it("reads Word files into sections", async () => {
    const { OfficeParser } = await import("officeparser");
    const md = Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1}: concord means the verb agrees with its subject in number and person.`).join("\n\n");
    const ast = await OfficeParser.parseOffice(Buffer.from(md), { fileType: "md" } as never);
    const docx = (await (ast as unknown as { to(f: "docx"): Promise<{ value: Uint8Array | Buffer }> }).to("docx")).value;
    const out = await extractOffice(new Uint8Array(docx), "docx", 60);
    expect(out.pages.length).toBeGreaterThanOrEqual(1);
    expect(out.pages[0].label).toBe("section 1");
    expect(out.pages.map((p) => p.text).join(" ")).toContain("Paragraph 30");
    expect(splitSections("aa\nbb\ncc", 3)).toHaveLength(3);
  });
});
