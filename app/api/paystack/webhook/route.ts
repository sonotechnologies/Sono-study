import { getDb } from "@/db";
import { applySuccessfulPayment, markPaymentFailed } from "@/lib/payments";
import { isValidWebhookSignature } from "@/lib/paystack";

/** Paystack webhook: the source of truth for payments, even if the student closes the tab. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!isValidWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const event = JSON.parse(raw) as { event: string; data?: { reference?: string; amount?: number; currency?: string } };
  const ref = event.data?.reference;
  if (ref) {
    const db = await getDb();
    if (event.event === "charge.success" && event.data?.currency === "NGN") {
      const result = await applySuccessfulPayment(db, ref, event.data.amount ?? 0);
      if (!result.ok) console.warn("Paystack webhook: payment not applied", ref, result.reason);
    } else if (event.event === "charge.failed") {
      await markPaymentFailed(db, ref);
    }
  }
  return new Response("ok");
}
