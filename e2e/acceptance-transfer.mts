/**
 * OPay / PalmPay transfer payments, in a real browser against a production build (run `npm run build` first):
 *   1. a free student opens the paywall and picks "Pay with OPay": the screen shows Sono's account,
 *      an exact amount unique to them and a code;
 *   2. "I've sent it" switches the Week Pass on at once;
 *   3. the phone's forwarded credit alert (posted to /api/payments/alert as the forwarder app would)
 *      matches it, and the screen turns to "You're on Week Pass";
 *   4. a second student's transfer that never arrives waits on /admin/payments, next to the
 *      unmatched money, and the admin rejects it.
 * Usage: npm run e2e:pay   (SHOTS=/dir to save screenshots)
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

const S = process.env.E2E_DIR ?? mkdtempSync(path.join(tmpdir(), "sono-e2e-pay-"));
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PORT = 3205;
const B = `http://localhost:${PORT}`;
const SECRET = "e2e-alert-secret";

const log = (...a: unknown[]) => console.log("✓", ...a);
const fail = (m: string) => {
  console.log("✗", m);
  process.exitCode = 1;
};

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
    PAYSTACK_SECRET_KEY: "",
    OPAY_ACCOUNT_NUMBER: "8012345678",
    OPAY_ACCOUNT_NAME: "Sono Technologies",
    PALMPAY_ACCOUNT_NUMBER: "9012345678",
    PALMPAY_ACCOUNT_NAME: "Sono Technologies",
    PAYMENT_ALERT_SECRET: SECRET,
    ADMIN_EMAILS: "tolu@example.com",
    PORT: String(PORT),
  },
});
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const errors: string[] = [];
async function student(): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(B + "/dev/new-student?ready=1&next=/profile", { waitUntil: "networkidle" });
  return page;
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: path.join(SHOTS, `pay-${name}.png`) });
const alert = (body: unknown, key = SECRET) =>
  fetch(B + "/api/payments/alert", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });

async function openTransfer(page: Page, method: "OPay" | "PalmPay") {
  await page.goto(B + "/profile?paywall=1", { waitUntil: "networkidle" });
  await page.getByRole("dialog").waitFor();
  await page.getByRole("radio", { name: /Week Pass/ }).check({ force: true });
  await shot(page, "paywall");
  await page.getByRole("button", { name: `Pay with ${method}` }).click();
  await page.waitForURL(/\/billing\/transfer\//, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  const text = await page.locator("main").innerText();
  const amount = text.match(/Send exactly ₦([\d,]+)/)?.[1].replace(/,/g, "");
  const code = text.match(/SONO-[A-Z0-9]{6}/)?.[0];
  return { text, amount: Number(amount), code };
}

// 1. Ada picks OPay.
const ada = await student();
const t = await openTransfer(ada, "OPay");
if (t.amount > 500 && t.amount < 600 && t.code && /8012345678/.test(t.text) && /Sono Technologies · OPay/.test(t.text))
  log(`transfer screen: send exactly ₦${t.amount} to 8012345678 (Sono Technologies · OPay), note ${t.code}`);
else fail(`transfer screen: ${t.text.slice(0, 300)}`);
await shot(ada, "details");

// 2. "I've sent it" → pass on at once.
await ada.getByRole("button", { name: `I've sent ₦${t.amount}` }).click();
await ada.getByRole("heading", { name: "Your Week Pass is on." }).waitFor({ timeout: 15_000 });
await shot(ada, "claimed");
await ada.goto(B + "/upload", { waitUntil: "networkidle" });
const limits = (await ada.locator("main").innerText()).match(/(\d+) of (\d+) uploads/);
if (limits && limits[2] === "15") log(`"I've sent ₦${t.amount}" switched the Week Pass on straight away (${limits[0]})`);
else fail(`limits after claim: ${limits?.[0]}`);

// 3. The phone forwards OPay's alert: confirmed automatically.
const denied = await alert({ app: "team.opay.pay", text: "You have received ₦1.00 from X" }, "wrong");
const res = await (await alert({ app: "team.opay.pay", title: "Transfer Received", text: `You have received ₦${t.amount}.00 from ADA OBI` })).json();
if (denied.status === 401 && res.status === "matched" && res.payment === t.code) log(`the forwarded alert "You have received ₦${t.amount}.00 from ADA OBI" matched ${t.code} (401 without the secret)`);
else fail(`alert: ${denied.status} ${JSON.stringify(res)}`);
await ada.goBack({ waitUntil: "networkidle" });
await ada.getByText("You're on Week Pass.").waitFor({ timeout: 25_000 }).catch(() => {});
if (/You're on Week Pass\./.test(await ada.locator("main").innerText())) log("the transfer screen turned to \"You're on Week Pass.\" on its own");
else fail(`after alert: ${(await ada.locator("main").innerText()).slice(0, 200)}`);
await shot(ada, "confirmed");

// 4. Bisi says she paid by PalmPay but nothing arrives; some other money comes in.
const bisi = await student();
const b = await openTransfer(bisi, "PalmPay");
await bisi.getByRole("button", { name: `I've sent ₦${b.amount}` }).click();
await bisi.getByRole("heading", { name: "Your Week Pass is on." }).waitFor({ timeout: 15_000 });
// Plain text with the key and app in the URL, the simplest thing a forwarder app can send.
const odd = await (
  await fetch(`${B}/api/payments/alert?key=${SECRET}&app=palmpay`, { method: "POST", headers: { "content-type": "text/plain" }, body: "Money In\nReceived ₦2,450.00 from MAMA CHI" })
).json();
const tolu = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
tolu.on("pageerror", (e) => errors.push(e.message));
await tolu.goto(B + "/admin/payments", { waitUntil: "networkidle" });
const admin = await tolu.locator("main").innerText();
if (odd.status === "unmatched" && odd.source === "palmpay" && admin.includes(b.code!) && /₦2,450 from MAMA CHI/.test(admin) && /Last alert from the phone/.test(admin))
  log(`/admin/payments lists Bisi's unconfirmed ${b.code} and the unmatched ₦2,450 from MAMA CHI`);
else fail(`admin page: ${admin.slice(0, 400)}`);
if (SHOTS) await tolu.screenshot({ path: path.join(SHOTS, "pay-admin.png"), fullPage: true });
await tolu.getByRole("listitem").filter({ hasText: b.code! }).getByRole("button", { name: /reject/ }).click();
await tolu.waitForLoadState("networkidle");
await bisi.goto(B + "/upload", { waitUntil: "networkidle" });
const bisiLimits = (await bisi.locator("main").innerText()).match(/(\d+) of (\d+) uploads/);
if (bisiLimits && bisiLimits[2] === "2") log(`rejected: Bisi is back on Free (${bisiLimits[0]})`);
else fail(`after reject: ${bisiLimits?.[0]}`);

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
else log("no page errors");
await browser.close();
stop();
