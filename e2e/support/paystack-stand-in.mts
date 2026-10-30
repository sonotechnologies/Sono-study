/**
 * A local stand-in for Paystack's transaction API, for the Milestone 6 check when no
 * sk_test_ key is set. It speaks the same requests and replies the app uses:
 *   POST /transaction/initialize  → authorization_url (a checkout page here)
 *   GET  /transaction/verify/:ref → status, amount, currency
 * and, like Paystack, signs a charge.success webhook (HMAC-SHA512 of the body with the
 * secret key) before redirecting the student to callback_url?reference=…
 */
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";

type Tx = { reference: string; amount: number; email: string; callbackUrl: string; status: "pending" | "success" | "abandoned" };

export function startPaystackStandIn(opts: { port: number; secretKey: string; webhookUrl: string }): Promise<{ server: Server; transactions: Map<string, Tx>; webhooks: number[] }> {
  const transactions = new Map<string, Tx>();
  const webhooks: number[] = [];
  const body = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let s = "";
      req.on("data", (c) => (s += c));
      req.on("end", () => resolve(s));
    });
  const json = (res: import("node:http").ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${opts.port}`);
    const authed = req.headers.authorization === `Bearer ${opts.secretKey}`;
    if (url.pathname === "/transaction/initialize" && req.method === "POST") {
      if (!authed) return json(res, 401, { status: false, message: "Invalid key" });
      const b = JSON.parse(await body(req));
      if (b.currency !== "NGN" || !b.reference || !(b.amount > 0)) return json(res, 400, { status: false, message: "Bad request" });
      transactions.set(b.reference, { reference: b.reference, amount: b.amount, email: b.email, callbackUrl: b.callback_url, status: "pending" });
      return json(res, 200, {
        status: true,
        message: "Authorization URL created",
        data: { authorization_url: `http://localhost:${opts.port}/checkout/${b.reference}`, access_code: `ac_${b.reference}`, reference: b.reference },
      });
    }
    const verify = url.pathname.match(/^\/transaction\/verify\/(.+)$/);
    if (verify && req.method === "GET") {
      if (!authed) return json(res, 401, { status: false, message: "Invalid key" });
      const tx = transactions.get(decodeURIComponent(verify[1]));
      if (!tx) return json(res, 404, { status: false, message: "Transaction reference not found" });
      return json(res, 200, { status: true, message: "Verification successful", data: { status: tx.status, reference: tx.reference, amount: tx.amount, currency: "NGN" } });
    }
    const checkout = url.pathname.match(/^\/checkout\/([^/]+)(\/pay|\/cancel)?$/);
    if (checkout) {
      const tx = transactions.get(checkout[1]);
      if (!tx) return json(res, 404, { status: false });
      if (checkout[2] === "/pay" && req.method === "POST") {
        tx.status = "success";
        const event = JSON.stringify({ event: "charge.success", data: { reference: tx.reference, amount: tx.amount, currency: "NGN", status: "success", customer: { email: tx.email } } });
        const signature = createHmac("sha512", opts.secretKey).update(event).digest("hex");
        const hook = await fetch(opts.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-paystack-signature": signature }, body: event });
        webhooks.push(hook.status);
        res.writeHead(302, { Location: `${tx.callbackUrl}?trxref=${tx.reference}&reference=${tx.reference}` });
        return res.end();
      }
      if (checkout[2] === "/cancel" && req.method === "POST") {
        tx.status = "abandoned";
        res.writeHead(302, { Location: `${tx.callbackUrl}?trxref=${tx.reference}&reference=${tx.reference}` });
        return res.end();
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Paystack test checkout</title>
<body style="font-family:sans-serif;padding:24px;max-width:420px;margin:auto">
<p style="color:#888">TEST MODE · stand-in</p><h1>Pay NGN ${(tx.amount / 100).toLocaleString("en-NG")}</h1><p>${tx.email}</p>
<form method="post" action="/checkout/${tx.reference}/pay"><button style="width:100%;height:48px;background:#0ba4db;color:#fff;border:0;border-radius:6px;font-size:16px">Pay NGN ${(tx.amount / 100).toLocaleString("en-NG")}</button></form>
<form method="post" action="/checkout/${tx.reference}/cancel"><button style="margin-top:12px;width:100%;height:40px">Cancel payment</button></form></body>`);
    }
    json(res, 404, { status: false, message: "Not found" });
  });
  return new Promise((resolve) => server.listen(opts.port, () => resolve({ server, transactions, webhooks })));
}
