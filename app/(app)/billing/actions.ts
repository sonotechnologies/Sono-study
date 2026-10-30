"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { applySuccessfulPayment, createPendingPayment } from "@/lib/payments";
import { initializeTransaction, paystackConfigured } from "@/lib/paystack";
import { PASSES, type PassProduct } from "@/lib/plans";
import { checkRateLimit, RateLimitError, requestIp } from "@/lib/rate-limit";
import { claimTransfer, startTransfer, TransferError, type ClaimResult, type TransferMethod } from "@/lib/transfers";
import { requireViewer } from "@/lib/viewer";

export interface CheckoutState {
  error: string | null;
}

async function origin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Paywall "Pay with Paystack": creates a pending payment and hands off to Paystack checkout. */
export async function startCheckout(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const product = form.get("product");
  if (product !== "week" && product !== "semester") return { error: "Pick a pass first." };
  const viewer = await requireViewer();
  const db = await getDb();
  try {
    await checkRateLimit(db, "payment", { userId: viewer.id, ip: await requestIp() });
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
  const payment = await createPendingPayment(db, viewer.id, product as PassProduct);

  if (!paystackConfigured()) {
    // Local dev without Paystack keys: complete the payment so the flow can be tried end to end.
    if (process.env.NODE_ENV === "production") return { error: "Payments aren't set up yet. Please try again later." };
    await applySuccessfulPayment(db, payment.reference, payment.amountKobo);
    redirect(`/billing/success?reference=${payment.reference}`);
  }

  if (!viewer.email) return { error: "Add an email to your account to pay." };
  let url: string;
  try {
    ({ authorizationUrl: url } = await initializeTransaction({
      email: viewer.email,
      amountKobo: payment.amountKobo,
      reference: payment.reference,
      callbackUrl: `${await origin()}/billing/callback`,
      metadata: { userId: viewer.id, product, pass: PASSES[product as PassProduct].name },
    }));
  } catch (err) {
    console.error(err);
    return { error: "Couldn't reach Paystack. Check your connection and try again." };
  }
  redirect(url);
}

/** Paywall "Pay with OPay / PalmPay": opens the transfer details screen. */
export async function startTransferAction(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const product = form.get("product");
  const method = form.get("method");
  if (product !== "week" && product !== "semester") return { error: "Pick a pass first." };
  if (method !== "opay" && method !== "palmpay") return { error: "Pick OPay or PalmPay." };
  const viewer = await requireViewer();
  const db = await getDb();
  let reference: string;
  try {
    await checkRateLimit(db, "payment", { userId: viewer.id, ip: await requestIp() });
    ({ reference } = await startTransfer(db, viewer.id, product as PassProduct, method as TransferMethod));
  } catch (err) {
    if (err instanceof RateLimitError || err instanceof TransferError) return { error: err.message };
    throw err;
  }
  redirect(`/billing/transfer/${reference}`);
}

export type ClaimActionResult = ({ ok: true } & ClaimResult) | { ok: false; error: string };

/** "I've sent it". */
export async function claimTransferAction(reference: string): Promise<ClaimActionResult> {
  const viewer = await requireViewer();
  const db = await getDb();
  try {
    await checkRateLimit(db, "payment", { userId: viewer.id, ip: await requestIp() });
    return { ok: true, ...(await claimTransfer(db, viewer.id, reference)) };
  } catch (err) {
    if (err instanceof RateLimitError || err instanceof TransferError) return { ok: false, error: err.message };
    throw err;
  }
}
