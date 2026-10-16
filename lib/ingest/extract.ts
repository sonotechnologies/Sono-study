/**
 * Text extraction (build brief: pdf-parse for PDFs, officeparser for PPTX/DOCX,
 * AI vision for photos — photos are read in the pipeline, through the AI adapter).
 * Every page keeps a label so questions and tutor answers can cite "p.4" or "slide 7".
 */

export type Page = { n: number; label: string; text: string };
export type Extracted = { pages: Page[]; pageCount: number };
export type DocumentKind = "pdf" | "pptx" | "docx";

export class ExtractError extends Error {}

const tidy = (s: string) =>
  s
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function extractPdf(bytes: Uint8Array, maxPages: number): Promise<Extracted> {
  const { PDFParse } = await import("pdf-parse");
  // pdf.js takes ownership of (detaches) the buffer it is given: hand it a copy.
  const parser = new PDFParse({ data: bytes.slice() });
  try {
    const result = await parser.getText({ first: maxPages });
    const pages = result.pages.map((p) => ({ n: p.num, label: `p.${p.num}`, text: tidy(p.text) }));
    return { pages, pageCount: result.total };
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (/password/i.test(msg)) throw new ExtractError("This PDF is password-protected. Remove the password and upload again.");
    throw new ExtractError("We couldn't open this PDF. Try exporting it again, or take photos of the pages.");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

type Node = { type?: string; text?: string; children?: Node[]; metadata?: { slideNumber?: number } };

function textOf(node: Node): string {
  if (node.children?.length) return node.children.map(textOf).filter(Boolean).join(node.type === "paragraph" || node.type === "heading" ? "" : "\n");
  return node.text ?? "";
}

/** Word files have no fixed pages: split into ~2,500-character sections at paragraph breaks. */
export function splitSections(text: string, size = 2500): string[] {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > size) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

export async function extractOffice(bytes: Uint8Array, kind: "pptx" | "docx", maxPages: number): Promise<Extracted> {
  const { OfficeParser } = await import("officeparser");
  let ast: { type: string; content: Node[]; to(format: "text"): Promise<{ value: string }> };
  try {
    ast = (await OfficeParser.parseOffice(Buffer.from(bytes))) as unknown as typeof ast;
  } catch {
    throw new ExtractError(`We couldn't open this ${kind === "pptx" ? "PowerPoint" : "Word"} file. Save it again as .${kind} and retry.`);
  }
  if (kind === "pptx") {
    const slides = ast.content.filter((n) => n.type === "slide" || n.metadata?.slideNumber);
    const pages = slides.map((s, i) => {
      const n = s.metadata?.slideNumber ?? i + 1;
      return { n, label: `slide ${n}`, text: tidy(textOf(s)) };
    });
    return { pages: pages.slice(0, maxPages), pageCount: pages.length };
  }
  const sections = splitSections(tidy((await ast.to("text")).value));
  const pages = sections.map((text, i) => ({ n: i + 1, label: `section ${i + 1}`, text }));
  return { pages: pages.slice(0, maxPages), pageCount: pages.length };
}

export async function extractDocument(bytes: Uint8Array, kind: DocumentKind, maxPages: number): Promise<Extracted> {
  return kind === "pdf" ? extractPdf(bytes, maxPages) : extractOffice(bytes, kind, maxPages);
}

/** Too little text to work with: probably a scanned PDF or picture-only slides. */
export function tooLittleText(pages: Page[]): boolean {
  const chars = pages.reduce((s, p) => s + p.text.replace(/\s/g, "").length, 0);
  return chars < Math.max(200, pages.length * 40);
}
