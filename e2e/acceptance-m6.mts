/**
 * Milestone 6 acceptance, in a real browser against a production build (run `npm run build` first):
 * a free user hits the daily question limit, buys a ₦500 Week Pass through Paystack checkout,
 * and the limits lift immediately.
 *
 * Paystack: with no key set, a local stand-in that speaks Paystack's transaction API
 * (initialize → checkout → signed charge.success webhook → callback → verify) is used.
 * With a real test key (PAYSTACK_SECRET_KEY=sk_test_…), point it at Paystack and complete the
 * test checkout by hand when the script pauses: E2E_PAYSTACK=real npm run e2e:m6 (headed browser).
 * Usage: npm run e2e:m6   (SHOTS=/dir to save screenshots)
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { makeNotesPdf } from "../tests/fixtures/notes";
import { startPaystackStandIn } from "./support/paystack-stand-in.mjs";

const S = process.env.E2E_DIR ?? mkdtempSync(path.join(tmpdir(), "sono-e2e-m6-"));
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PORT = 3204;
const B = `http://localhost:${PORT}`;
const REAL = process.env.E2E_PAYSTACK === "real";
const KEY = REAL ? process.env.PAYSTACK_SECRET_KEY : "sk_test_standin";
if (REAL && !KEY?.startsWith("sk_test_")) throw new Error("E2E_PAYSTACK=real needs PAYSTACK_SECRET_KEY=sk_test_…");
const STAND_IN = 3290;

const log = (...a: unknown[]) => console.log("✓", ...a);
const fail = (m: string) => {
  console.log("✗", m);
  process.exitCode = 1;
};

const standIn = REAL ? null : await startPaystackStandIn({ port: STAND_IN, secretKey: KEY!, webhookUrl: `${B}/api/paystack/webhook` });
if (await fetch(B + "/offline").then(() => true, () => false)) throw new Error(`Port ${PORT} is already in use: stop the old server first.`);
const server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
  cwd: process.cwd(),
  stdio: "ignore",
  detached: true,
  env: {
    ...process.env,
    ALLOW_DEMO: "1",
    ALLOW_EMBEDDED_DB: "1",
    ALLOW_LOCAL_STORAGE: "1",
    PGLITE_DIR: path.join(S, "db"),
    LOCAL_STORAGE_DIR: path.join(S, "files"),
    AI_PROVIDERS: "fake",
    APP_URL: B,
    PAYSTACK_SECRET_KEY: KEY,
    ...(REAL ? {} : { PAYSTACK_API_URL: `http://localhost:${STAND_IN}` }),
    PORT: String(PORT),
  },
});
const stop = () => {
  try {
    process.kill(-server.pid!, "SIGKILL");
  } catch {}
  standIn?.server.close();
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", headless: !REAL });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name: string) => SHOTS && page.screenshot({ path: path.join(SHOTS, `m6-${name}.png`) });

async function uploadPdf(file: string) {
  await page.goto(B + "/upload?course=crs-gst111", { waitUntil: "networkidle" });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: /Files/ }).click()]);
  await chooser.setFiles(file);
  await page.getByRole("button", { name: "Make questions" }).click();
  await page.getByText(/^\d+ questions?$/).waitFor({ timeout: 120_000 });
  return Number((await page.getByText(/^\d+ questions?$/).innerText()).split(" ")[0]);
}

// 1. A free student uses up today's AI questions.
await page.goto(B + "/dev/new-student?ready=1&next=/upload?course=crs-gst111", { waitUntil: "networkidle" });
const first = path.join(S, "GST111 week 3.pdf");
writeFileSync(first, await makeNotesPdf(20));
const made = await uploadPdf(first);
log(`free student turned 20 pages into ${made} questions`);

await page.goto(B + "/upload", { waitUntil: "networkidle" });
const limitText = await page.locator("main").innerText();
if (/40 (free )?AI questions/.test(limitText) && (await page.getByRole("link", { name: /Go Pro/ }).count())) log("hit the daily limit: the upload screen shows today's 40 AI questions are used, with Go Pro");
else fail(`expected the AI-question limit screen, got: ${limitText.slice(0, 200)}`);
await shot("limit");

// 2. Buy a Week Pass.
await page.getByRole("link", { name: /Go Pro/ }).click();
await page.getByRole("dialog").waitFor();
await page.getByRole("radio", { name: /Week Pass/ }).check({ force: true });
await shot("paywall");
await page.getByRole("button", { name: /Pay ₦500 with Paystack/ }).click();
if (REAL) {
  console.log("→ Complete the Paystack test checkout in the browser window (test card 4084 0840 8408 4081, any future expiry, CVV 408).");
  await page.waitForURL(/\/billing\/success/, { timeout: 10 * 60_000 });
} else {
  await page.waitForURL(new RegExp(`localhost:${STAND_IN}/checkout/`), { timeout: 30_000 });
  log("Paystack checkout opened for NGN 500");
  await shot("checkout");
  await page.getByRole("button", { name: "Pay NGN 500" }).click();
  await page.waitForURL(/\/billing\/success/, { timeout: 30_000 });
}
await page.waitForLoadState("networkidle");
const success = await page.locator("main").innerText();
if (/Week Pass/i.test(success)) log(`paid: back in the app on "${success.split("\n").slice(0, 2).join(" · ")}"`);
else fail(`success page: ${success.slice(0, 200)}`);
if (standIn) {
  const ok = standIn.webhooks.length === 1 && standIn.webhooks[0] === 200;
  if (ok) log("Paystack's signed charge.success webhook was accepted (200) and the payment applied once");
  else fail(`webhook statuses: ${standIn.webhooks.join(",")}`);
}
await shot("success");

// 3. Limits lift immediately.
await page.goto(B + "/upload", { waitUntil: "networkidle" });
const after = await page.locator("main").innerText();
const left = after.match(/(\d+) of (\d+) uploads and (\d+) of (\d+) AI questions left today/);
if (left && Number(left[4]) === 400 && Number(left[3]) === 400 - made) log(`limits lifted at once: ${left[0]}`);
else fail(`expected Pro limits, got: ${after.slice(0, 200)}`);
const second = path.join(S, "GST111 week 4.pdf");
writeFileSync(second, new Uint8Array([...(await makeNotesPdf(12)), 4]));
const more = await uploadPdf(second);
if (more > 0) log(`and the next upload made ${more} more questions the same day`);
else fail("second upload made no questions");
await page.goto(B + "/profile", { waitUntil: "networkidle" });
if (/Pro|Week Pass/.test(await page.locator("main").innerText())) log("profile shows the pass");
await shot("profile");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
else log("no page errors");
await browser.close();
stop();
