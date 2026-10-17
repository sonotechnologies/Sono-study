/**
 * Milestone 4 acceptance, in a real browser against a production build (run `npm run build` first):
 * a second student on the same school + course sees and practises the first student's
 * contributed questions.
 *   1. Ada (UNILAG, GST 111) uploads notes with "Share with your class" on.
 *   2. Bisi (same school and course) opens the GST 111 course page: Ada's bank is listed
 *      under Shared banks; she starts it and the mock is made of Ada's questions.
 *   3. Bisi finishes it and rates the bank; Ada's practice question earns her +50 XP.
 *   4. Ada turns sharing off: the bank disappears from Bisi's course page.
 * (Students at another school never see it: courses are per school; see tests/shared-banks.test.ts.)
 * Usage: npm run e2e:m4
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { makeNotesPdf } from "../tests/fixtures/notes";

const S = process.env.E2E_DIR ?? mkdtempSync(path.join(tmpdir(), "sono-e2e-m4-"));
const PORT = 3202;
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

const server: ChildProcess = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], { cwd: process.cwd(), env, stdio: "ignore" });
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(B + "/offline")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
await fetch(B + "/home");

const pdfPath = path.join(S, "Ada GST111 notes.pdf");
writeFileSync(pdfPath, await makeNotesPdf(12));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const errors: string[] = [];
async function student(): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}

// 1. Ada uploads and shares
const ada = await student();
await ada.goto(B + "/dev/new-student?ready=1&next=/upload?course=crs-gst111", { waitUntil: "networkidle" });
const adaId = (await ada.context().cookies()).find((c) => c.name === "sono_dev_user")!.value;
const [chooser] = await Promise.all([ada.waitForEvent("filechooser"), ada.getByRole("button", { name: /Files/ }).click()]);
await chooser.setFiles(pdfPath);
if (!(await ada.getByRole("switch").isChecked())) fail("contribute toggle should default to on");
await ada.getByRole("button", { name: "Make questions" }).click();
await ada.getByText(/^\d+ questions?$/).waitFor({ timeout: 120_000 });
const uploadUrl = ada.url();
const made = Number((await ada.getByText(/^\d+ questions?$/).innerText()).split(" ")[0]);
await ada.goto(uploadUrl + "/questions", { waitUntil: "networkidle" });
const adaStems = new Set((await ada.locator("ol > li > p:nth-of-type(1)").allInnerTexts()).map((s) => s.trim()));
log(`Ada uploaded and shared: ${made} questions (${adaStems.size} stems collected)`);
const xpBefore = Number((await (await fetch(B + "/api/me/export", { headers: { cookie: `sono_dev_user=${adaId}` } })).json()).profile?.xp ?? NaN);

// 2. Bisi sees the bank on the course page and takes it
const bisi = await student();
await bisi.goto(B + "/dev/new-student?ready=1&next=/courses/crs-gst111", { waitUntil: "networkidle" });
const bankRow = bisi.getByRole("link", { name: /Ada GST111 notes/ });
if (await bankRow.count()) log(`Bisi's GST 111 page lists Ada's bank: "${(await bankRow.innerText()).replace(/\s+/g, " ")}"`);
else fail("Ada's bank is missing from Bisi's course page");
await bankRow.click();
await bisi.waitForURL(/\/mock\?bank=/);
await bisi.getByRole("button", { name: /^Start/ }).click();
await bisi.waitForURL(/\/mock\/[^/?]+$/, { timeout: 30_000 });
await bisi.waitForLoadState("networkidle");
const stem = (await bisi.locator("main p").first().innerText()).trim();
if (adaStems.has(stem)) log(`Bisi's mock opens on one of Ada's questions: "${stem.slice(0, 60)}…"`);
else fail(`Bisi's first question isn't Ada's: "${stem}"`);

// 3. Finish (submit straight away), rate the bank, and Ada gets classmate XP
await bisi.getByRole("button", { name: /All questions/ }).click();
await bisi.getByRole("button", { name: /^Submit \d+ of/ }).click();
await bisi.getByRole("button", { name: "Submit", exact: true }).click();
await bisi.waitForURL(/\/results\//, { timeout: 30_000 });
await bisi.getByRole("radio", { name: "4 stars" }).click();
await bisi.getByText(/Thanks\. 1 rating, average 4\.0/).waitFor({ timeout: 10_000 });
log("Bisi finished it and rated the bank 4★");
const xpAfter = Number((await (await fetch(B + "/api/me/export", { headers: { cookie: `sono_dev_user=${adaId}` } })).json()).profile?.xp ?? NaN);
if (xpAfter - xpBefore === 50) log(`Ada earned +50 XP when a classmate used her questions (${xpBefore} → ${xpAfter})`);
else fail(`classmate XP: ${xpBefore} → ${xpAfter}`);

// 4. Ada turns sharing off → the bank leaves Bisi's course page
await ada.goto(uploadUrl + "/questions", { waitUntil: "networkidle" });
await ada.getByRole("switch").click();
await ada.waitForTimeout(1500);
await bisi.goto(B + "/courses/crs-gst111", { waitUntil: "networkidle" });
if ((await bisi.getByRole("link", { name: /Ada GST111 notes/ }).count()) === 0) log("after Ada turned sharing off, the bank is gone from Bisi's page");
else fail("bank still visible after sharing was turned off");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
else log("no page errors");
await browser.close();
server.kill("SIGKILL");
