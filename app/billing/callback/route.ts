import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { applySuccessfulPayment, getPayment, markPaymentFailed } from "@/lib/payments";
import { verifyTransaction } from "@/lib/paystack";

/** Paystack redirects here after checkout. Verify server-side, never trust the query string. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  if (!reference) return NextResponse.redirect(new URL("/profile", req.url));
  const db = await getDb();
  const payment = await getPayment(db, reference);
  if (!payment) return NextResponse.redirect(new URL("/profile", req.url));

  if (payment.status === "pending") {
    try {
      const tx = await verifyTransaction(reference);
      if (tx.status === "success" && tx.currency === "NGN") await applySuccessfulPayment(db, reference, tx.amountKobo);
      else if (tx.status === "failed" || tx.status === "abandoned") await markPaymentFailed(db, reference);
    } catch (err) {
      // The webhook will still confirm it; the success page shows "confirming".
      console.error("Paystack verify failed", err);
    }
  }
  return NextResponse.redirect(new URL(`/billing/success?reference=${encodeURIComponent(reference)}`, req.url));
}
