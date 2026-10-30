/**
 * Milestone 5 acceptance, in a real browser against a production build (run `npm run build` first):
 *   1. the tutor cites the right page for an answer (and the citation opens that page of the student's file),
 *   2. it refuses to invent an answer the notes don't contain;
 * plus a flashcard session (flip, rate, summary) and a theory answer marked against its guide.
 * Usage: npm run e2e:m5   (SHOTS=/dir to save screenshots)
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { makeTutorPdf } from "../tests/fixtures/notes";

const S = process.env.E2E_DIR ?? mkdtempSync(path.join(tmpdir(), "sono-e2e-m5-"));
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PORT = 3203;
const B = `http://localhost:${PORT}`;
const env = {
  ...process.env,
  ALLOW_DEMO: "1",
  ALLOW_EMBEDDED_DB: "1",
  ALLOW_LOCAL_STORAGE: "1",
  PGLITE_DIR: path.join(S, "db"),
  LOCAL_STORAGE_DIR: path.join(S, "files"),
  AI_PROVIDERS: "fake",
  PORT: String(PORT),
};
const log = (...a: unknown[]) => console.log("✓", ...a);
const fail = (m: string) => {
  console.log("✗", m);
  process.exitCode = 1;
};

// A server left over from an earlier run would answer instead of ours, with its own data.
if (await fetch(B + "/offline").then(() => true, () => false)) throw new Error(`Port ${PORT} is already in use: stop the old server first.`);
// Own process group, so killing it also stops the next-server child.
const server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], { cwd: process.cwd(), env, stdio: "ignore", detached: true });
const stop = () => {
  try {
    process.kill(-server.pid!, "SIGKILL");
  } catch {}
};
process.on("exit", stop);
process.on("uncaughtException", (e) => {
  console.error(e);
  stop();
  process.exit(1);
});
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(B + "/offline")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
await fetch(B + "/home");

const pdfPath = path.join(S, "Week 3 slides.pdf");
writeFileSync(pdfPath, await makeTutorPdf());
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name: string) => SHOTS && page.screenshot({ path: path.join(SHOTS, `m5-${name}.png`), fullPage: false });

// Notes in: upload the 6-page slides.
await page.goto(B + "/dev/new-student?ready=1&next=/upload?course=crs-gst111", { waitUntil: "networkidle" });
const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: /Files/ }).click()]);
await chooser.setFiles(pdfPath);
await page.getByRole("button", { name: "Make questions" }).click();
await page.getByText(/^\d+ questions?$/).waitFor({ timeout: 120_000 });
log("uploaded Week 3 slides (6 pages)");

// 1. Tutor cites the right page.
await page.goto(B + "/tutor/crs-gst111", { waitUntil: "networkidle" });
await shot("tutor-empty");
if (process.env.DEBUG) console.log("DEBUG header:", await page.locator("main").innerText().then((t) => t.slice(0, 120)), (await page.context().cookies()).map((c) => `${c.name}=${c.value}`));
const ask = async (q: string) => {
  const before = await page.locator("[aria-label=Sources]").count();
  const replies = await page.locator("p.whitespace-pre-wrap").count();
  await page.getByLabel(/Ask about/).fill(q);
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForFunction((n) => document.querySelectorAll("p.whitespace-pre-wrap").length >= n + 2, replies, { timeout: 30_000 });
  return { newSources: (await page.locator("[aria-label=Sources]").count()) > before, text: await page.locator("p.whitespace-pre-wrap").last().innerText() };
};
const a1 = await ask("What are the four stages of listening?");
if (process.env.DEBUG) console.log("DEBUG", a1, await page.locator("[aria-label=Sources]").last().innerHTML().catch(() => "none"));
const chip = page.locator("[aria-label=Sources] a").last();
const label = a1.newSources ? await chip.innerText() : "";
const href = a1.newSources ? await chip.getAttribute("href") : "";
if (label === "Week 3 slides · p.3" && /receiving, understanding, evaluating and responding/.test(a1.text)) log(`tutor answered from the notes and cited "${label}"`);
else fail(`expected a p.3 citation, got "${label}" / "${a1.text}"`);
if (href && /n=3#page=3$/.test(href)) {
  const res = await page.request.get(B + href.replace(/#.*$/, ""));
  if (res.ok() && res.headers()["content-type"] === "application/pdf") log(`the citation opens the student's own PDF at page 3 (${href})`);
  else fail(`citation link failed: ${res.status()}`);
} else fail(`citation href: ${href}`);
await shot("tutor-cited");

// 2. Refuses to invent.
const a2 = await ask("Who won the 2018 FIFA World Cup final?");
if (!a2.newSources && /don't cover that, so I won't guess/.test(a2.text)) log(`asked something not in the notes: "${a2.text.slice(0, 70)}…" with no citation`);
else fail(`expected a refusal, got "${a2.text}" (sources: ${a2.newSources})`);
await shot("tutor-refused");

// Quick action on a cited answer.
await ask("What causes semantic noise?");
await page.getByRole("button", { name: "Explain simpler" }).click();
await page.waitForFunction(() => /Explain your last answer more simply/.test(document.body.innerText), null, { timeout: 30_000 });
if ((await page.locator("[aria-label=Sources] a").last().innerText()) === "Week 3 slides · p.4") log('"Explain simpler" follows up on the last answer, still citing p.4');
else fail("quick action citation");

// Flashcards: a session to the summary.
await page.goto(B + "/cards/crs-gst111", { waitUntil: "networkidle" });
const total = Number((await page.locator("main").innerText()).match(/(\d+)\/(\d+)/)?.[2] ?? 0);
await shot("card-front");
let rated = 0;
for (let i = 0; i < total; i++) {
  await page.getByRole("button", { name: "Show answer" }).click();
  if (i === 0) await shot("card-back");
  await page.getByRole("button", { name: i % 4 === 0 ? /^Again/ : /^Good/ }).click();
  rated++;
}
await page.getByText(/cards done\./).waitFor({ timeout: 15_000 }).catch(async (e) => {
  await page.screenshot({ path: path.join(SHOTS ?? S, "m5-card-stuck.png") });
  console.log("stuck at:", (await page.locator("main").innerText()).slice(0, 300));
  throw e;
});
await shot("card-summary");
const summary = await page.locator("main").innerText();
if (new RegExp(`${rated} cards done`).test(summary) && /\+\d+ XP/.test(summary)) log(`flashcards: rated ${rated} cards, summary shows ${summary.match(/\+\d+ XP/)?.[0]}`);
else fail("flashcard summary");

// Theory: write, mark, see covered / missed.
await page.goto(B + "/courses/crs-gst111/theory", { waitUntil: "networkidle" });
await page.locator("main ol a", { hasText: /hearing and listening/ }).click();
await page.waitForURL(/\/theory\//);
await page.getByLabel("Your answer").fill(
  "Hearing is the passive, physical reception of sound. Listening is active: attending to, interpreting and responding to the message. Good listeners give feedback and ask questions, and avoid interrupting.",
);
await page.getByRole("button", { name: "Mark my answer" }).click();
await page.getByRole("region", { name: "Marking" }).waitFor({ timeout: 30_000 });
await shot("theory");
const marking = await page.getByRole("region", { name: "Marking" }).innerText();
const score = marking.match(/(\d+(?:\.\d)?)\/(\d+)/);
if (score && /Covered/.test(marking) && Number(score[1]) > 0) log(`theory answer marked ${score[0]} against the guide, with covered and missed points`);
else fail("theory marking");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
else log("no page errors");
await browser.close();
stop();
