/**
 * Milestone 3 acceptance, in a real browser against a production build (run `npm run build` first):
 *   1. a 20-page PDF becomes 30+ questions and flashcards,
 *   2. a re-upload of the same file (by a classmate) is instant,
 *   3. forcing one provider to fail switches to the next: the server runs with
 *      AI_PROVIDERS=fake,fake-backup and AI_FORCE_FAIL=fake, so every call to "fake"
 *      hits a 429; the work must be done by "fake-backup" and "fake" must be cooling down.
 * With real keys, the same check is AI_PROVIDERS=gemini,groq AI_FORCE_FAIL=gemini.
 * Usage: npm run e2e:m3   (CHROMIUM_PATH=/path/to/chrome to choose the browser)
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { makeNotesPdf } from "../tests/fixtures/notes";

const S = process.env.E2E_DIR ?? mkdtempSync(path.join(tmpdir(), "sono-e2e-m3-"));
const PORT = 3201;
const B = `http://localhost:${PORT}`;
const PROVIDERS = process.env.E2E_PROVIDERS ?? "fake,fake-backup";
const FORCE_FAIL = process.env.E2E_FORCE_FAIL ?? "fake";
const env = {
  ...process.env,
  ALLOW_DEMO: "1",
  ALLOW_EMBEDDED_DB: "1",
  ALLOW_LOCAL_STORAGE: "1",
  PGLITE_DIR: path.join(S, "db"),
  LOCAL_STORAGE_DIR: path.join(S, "files"),
  AI_PROVIDERS: PROVIDERS,
  AI_FORCE_FAIL: FORCE_FAIL,
  PORT: String(PORT),
};
let server!: ChildProcess;
const log = (...a: unknown[]) => console.log("✓", ...a);
const fail = (m: string) => {
  console.log("✗", m);
  process.exitCode = 1;
};

async function up() {
  server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], { cwd: process.cwd(), env, stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(B + "/offline")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

const pdfPath = path.join(S, "GST111 week 3 notes.pdf");
writeFileSync(pdfPath, await makeNotesPdf(20));

await up();
await fetch(B + "/home"); // first request migrates + seeds the embedded DB
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const errors: string[] = [];

async function uploadAsNewClassmate() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(B + "/dev/new-student?ready=1&next=/upload?course=crs-gst111", { waitUntil: "networkidle" });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: /Files/ }).click()]);
  await chooser.setFiles(pdfPath);
  const t0 = Date.now();
  await page.getByRole("button", { name: "Make questions" }).click();
  await page.getByText(/^\d+ questions?$/).waitFor({ timeout: 180_000 });
  const seconds = (Date.now() - t0) / 1000;
  const questions = Number((await page.getByText(/^\d+ questions?$/).innerText()).split(" ")[0]);
  const cards = Number((await page.getByText(/Also made \d+ flashcards/).innerText().catch(() => "0")).match(/\d+/)?.[0] ?? 0);
  const topics = await page.locator("main ul li").allInnerTexts();
  const text = await page.locator("main").innerText();
  return { page, ctx, seconds, questions, cards, topics, text };
}

// 1. 20 pages → 30+ questions and flashcards
const first = await uploadAsNewClassmate();
if (first.questions >= 30 && first.cards > 0) log(`20-page PDF → ${first.questions} questions and ${first.cards} flashcards in ${first.seconds.toFixed(1)}s (topics: ${first.topics.join(", ")})`);
else fail(`expected 30+ questions and some flashcards, got ${first.questions} questions, ${first.cards} flashcards`);

// …and they work in a mock
await first.page.getByRole("button", { name: /Start a \d+-question mock/ }).click();
await first.page.waitForURL(/\/mock\//, { timeout: 30_000 });
const navCells = await first.page.locator("nav button, [aria-label^='Question']").count();
if (first.page.url().includes("/mock/")) log(`"Start a 20-question mock" opens the exam (${navCells} navigator cells)`);
else fail("mock did not start");
await first.ctx.close();

// 2. Same file again, by another classmate: instant
const second = await uploadAsNewClassmate();
if (second.questions === first.questions && /Ready instantly/.test(second.text) && second.seconds < 5) {
  log(`re-upload of the same file ready in ${second.seconds.toFixed(1)}s with the same ${second.questions} questions, no AI used`);
} else fail(`re-upload: ${second.seconds.toFixed(1)}s, ${second.questions} questions, reused=${/Ready instantly/.test(second.text)}`);
await second.ctx.close();
await browser.close();

server.kill("SIGKILL");
await new Promise((r) => setTimeout(r, 1500));

// 3. Provider failover, read from the database the server used
const { PGlite } = await import("@electric-sql/pglite");
const { vector } = await import("@electric-sql/pglite-pgvector");
const db = new PGlite(env.PGLITE_DIR, { extensions: { vector } });
const used = await db.query<{ provider: string; n: number }>(
  "select provider, count(*)::int as n from ai_jobs where type = 'generate_chunk' and provider is not null group by provider",
);
const states = await db.query<{ name: string; failures: number; cooldown_until: Date | null; calls: number }>("select name, failures, calls, cooldown_until from ai_providers");
await db.close();
const failed = states.rows.find((r) => r.name === FORCE_FAIL);
const backupOnly = used.rows.length > 0 && used.rows.every((r) => r.provider !== FORCE_FAIL);
if (backupOnly && failed && failed.failures > 0 && failed.cooldown_until) {
  log(
    `forced "${FORCE_FAIL}" to fail: it went on cooldown after ${failed.failures} failure(s); all ${used.rows.reduce((s, r) => s + r.n, 0)} chunks were generated by ${used.rows.map((r) => r.provider).join(", ")}`,
  );
} else fail(`failover: providers used ${JSON.stringify(used.rows)}, states ${JSON.stringify(states.rows)}`);

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
else log("no page errors");
