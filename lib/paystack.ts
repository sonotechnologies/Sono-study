import { createHmac, timingSafeEqual } from "node:crypto";

/** PAYSTACK_API_URL points the app at a stand-in (the e2e checks use one); production always uses Paystack. */
function api(): string {
  return (process.env.PAYSTACK_API_URL || "https://api.paystack.co").replace(/\/$/, "");
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

function secret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${api()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !body.status) throw new Error(`Paystack ${path}: ${body.message ?? res.status}`);
  return body.data;
}

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<{ authorizationUrl: string }> {
  const data = await call<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ["card", "bank_transfer", "ussd", "bank"],
      metadata: input.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url };
}

export interface VerifiedTransaction {
  status: "success" | "failed" | "abandoned" | "pending" | string;
  reference: string;
  amountKobo: number;
  currency: string;
}

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await call<{ status: string; reference: string; amount: number; currency: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return { status: data.status, reference: data.reference, amountKobo: data.amount, currency: data.currency };
}

/** Paystack signs webhook bodies with HMAC-SHA512 of the raw body using the secret key. */
export function isValidWebhookSignature(rawBody: string, signature: string | null, key = process.env.PAYSTACK_SECRET_KEY): boolean {
  if (!signature || !key) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
