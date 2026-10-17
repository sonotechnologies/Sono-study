/**
 * Milestone 2 acceptance, in a real browser against a production build (run `npm run build` first):
 *   1. a 30-question mock auto-submits at zero (1-minute demo timer),
 *   2. it survives going offline mid-exam: the server is killed, the student keeps answering,
 *      reloads with no connection, then the server comes back and everything syncs,
 *   3. the per-topic breakdown adds up and matches the review list.
 * Usage: npm run e2e:m2   (CHROMIUM_PATH=/path/to/chrome to choose the browser)
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const S = process.env.E2E_DIR ?? mkdtempSync(path.join(tmpdir(), "sono-e2e-"));
const B = "http://localhost:3200";
const env = { ...process.env, ALLOW_DEMO: "1", ALLOW_EMBEDDED_DB: "1", PGLITE_DIR: path.join(S, "db"), PORT: "3200" };
let server;
async function up() {
  server = spawn("node_modules/.bin/next", ["start", "-p", "3200"], { cwd: process.cwd(), env, stdio: "ignore", detached: true });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(B + "/offline")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  throw new Error("server did not start");
}
async function down() {
  // Own process group: kill it whole, or next-server outlives its parent.
  try { process.kill(-server.pid, "SIGKILL"); } catch {}
  for (let i = 0; i < 40; i++) { try { await fetch(B + "/offline"); await new Promise((r) => setTimeout(r, 250)); } catch { return; } }
}
process.on("exit", () => { try { process.kill(-server.pid, "SIGKILL"); } catch {} });
const log = (...a) => console.log("✓", ...a);
const fail = (m) => { console.log("✗", m); process.exitCode = 1; };

await up();
await fetch(B + "/home"); // first request migrates + seeds the embedded DB
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function answerCurrent(pick = 0) {
  const opts = page.locator("main [role=radiogroup] button, main [role=group] button");
  const n = await opts.count();
  if (n) await opts.nth(pick % n).click(); else await page.locator("main input").first().fill("answer");
}
async function startMock(time) {
  await page.goto(B + "/courses/crs-gst111/mock?quick=1", { waitUntil: "load" });
  await page.getByRole("radio", { name: time === 1 ? "1 minutes" : "25 minutes" }).check({ force: true });
  await page.getByRole("button", { name: "Start mock" }).click();
  await page.waitForURL(/\/mock\//, { timeout: 60000 });
  await page.getByText("Question 1 of 30").waitFor();
}

// ── 1. Auto-submit at zero ─────────────────────────────────────────────────
await startMock(1);
for (let i = 0; i < 4; i++) { await answerCurrent(i); await page.getByRole("button", { name: /^Next/ }).click(); }
const t0 = Date.now();
await page.waitForURL(/\/results\//, { timeout: 120000 });
const took = Math.round((Date.now() - t0) / 1000);
const body1 = await page.locator("main").innerText();
if (body1.includes("Time ran out")) log(`auto-submitted at zero (redirected to results ${took}s after the last answer)`);
else fail("no auto-submit notice");
const score1 = await page.locator("main span[aria-label]").first().getAttribute("aria-label");
log(`score shown: ${score1}/30, answered 4`);

// ── 2. Offline mid-exam ────────────────────────────────────────────────────
await startMock(25);
for (let i = 0; i < 5; i++) { await answerCurrent(i); await page.getByRole("button", { name: /^Next/ }).click(); }
await page.waitForTimeout(1500); // let the online answers sync
await page.waitForFunction(() => document.documentElement.dataset.offlineReady, null, { timeout: 30000 });
log("mock page saved for offline: " + (await page.evaluate(() => document.documentElement.dataset.offlineReady)));
await down();
log("server stopped mid-mock");
for (let i = 5; i < 10; i++) { await answerCurrent(i); await page.getByRole("button", { name: /^Next/ }).click(); }
await page.getByText(/You're offline/).waitFor({ timeout: 30000 });
log("offline banner shown; kept answering (Q6–Q10)");
await page.reload({ waitUntil: "load" }).catch((e) => fail("reload offline failed: " + e.message));
await page.getByText(/Question \d+ of 30/).waitFor({ timeout: 20000 });
const counter = await page.getByRole("button", { name: /All questions/ }).innerText();
if (counter.includes("10/30")) log(`reopened offline from the phone's cache with all 10 answers (${counter.trim()})`);
else fail(`after offline reload the counter says ${counter}`);
await page.waitForTimeout(2000);
const timer = await page.getByRole("timer").innerText();
log(`timer still running offline: ${timer}`);
await up();
log("server back");
await page.getByText(/You're offline/).waitFor({ state: "detached", timeout: 60000 });
log("synced after reconnect (banner cleared)");
await page.getByRole("button", { name: /All questions/ }).click();
await page.getByRole("button", { name: /^Submit \d+ of/ }).click();
await page.getByRole("button", { name: "Submit", exact: true }).click();
await page.waitForURL(/\/results\//, { timeout: 60000 });

// ── 3. Per-topic breakdown matches the answers ─────────────────────────────
const resultsUrl = page.url();
const score = Number(await page.locator("main span[aria-label]").first().getAttribute("aria-label"));
const rows = await page.locator('section[aria-label="All questions"] li').allInnerTexts();
const badges = await page.locator('section[aria-label="All questions"] li [aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const correct = badges.filter((b) => b === "Correct").length;
const answered = badges.filter((b) => b !== "Skipped").length;
if (answered === 10) log(`all 10 answers (5 online + 5 offline) counted after reconnect`);
else fail(`answered ${answered}, expected 10`);
if (correct === score) log(`score ${score} = ${correct} correct in the review list`);
else fail(`score ${score} but ${correct} correct`);
const topicLines = await page.locator("ul li").filter({ hasText: / · (weak|shaky|good|mastered)$/ }).allInnerTexts();
const byTopic = topicLines.map((l) => l.match(/(\d+)\/(\d+) · /)).filter(Boolean).map((m) => [+m[1], +m[2]]);
// "By topic" list is the last such list on the page
const unique = byTopic.slice(-[...new Set(topicLines.map((l) => l.split("\n")[0]))].length);
const sumT = unique.reduce((s, [, t]) => s + t, 0), sumC = unique.reduce((s, [c]) => s + c, 0);
if (sumT === 30 && sumC === score) log(`by-topic adds up: ${sumC}/${sumT} across ${unique.length} topics`);
else fail(`by-topic sums ${sumC}/${sumT}`);
console.log(rows.length === 30 ? "" : `(review rows: ${rows.length})`);
console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
server.kill("SIGKILL");
console.log("results:", resultsUrl);
process.exit(process.exitCode ?? 0);
