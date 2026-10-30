import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { payments, users, type Payment } from "@/db/schema";
import { extendProUntil, newPaymentReference } from "./billing";
import { PASSES, type PassProduct } from "./plans";

export async function createPendingPayment(db: Db, userId: string, product: PassProduct): Promise<Payment> {
  const [payment] = await db
    .insert(payments)
    .values({ userId, product, reference: newPaymentReference(), amountKobo: PASSES[product].amountKobo })
    .returning();
  return payment;
}

export async function getPayment(db: Db, reference: string): Promise<Payment | null> {
  const [p] = await db.select().from(payments).where(eq(payments.reference, reference));
  return p ?? null;
}

export type ApplyResult =
  | { ok: true; payment: Payment; proUntil: Date; alreadyApplied: boolean }
  | { ok: false; reason: "not_found" | "amount_mismatch" };

/**
 * Marks a payment successful and extends the user's Pro time. Idempotent:
 * the callback redirect and the webhook can both arrive; only the first one
 * that flips to success extends proUntil. A claimed transfer already has its
 * pass (granted when the student tapped "I've sent it"), so it is only confirmed.
 */
export async function applySuccessfulPayment(
  db: Db,
  reference: string,
  paidAmountKobo: number,
  now: Date = new Date(),
  confirmedBy = "paystack",
): Promise<ApplyResult> {
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.reference, reference)).for("update");
    if (!payment) return { ok: false, reason: "not_found" } as const;
    if (paidAmountKobo < payment.amountKobo) return { ok: false, reason: "amount_mismatch" } as const;

    const [user] = await tx.select({ proUntil: users.proUntil }).from(users).where(eq(users.id, payment.userId)).for("update");
    if (payment.status === "success") {
      return { ok: true, payment, proUntil: user.proUntil ?? now, alreadyApplied: true } as const;
    }
    const granted = payment.status === "claimed";
    const proUntil = granted ? (user.proUntil ?? now) : extendProUntil(user.proUntil, payment.product, now);
    const [updated] = await tx
      .update(payments)
      .set({ status: "success", paidAt: now, confirmedBy })
      .where(and(eq(payments.id, payment.id), eq(payments.status, payment.status)))
      .returning();
    if (!granted) await tx.update(users).set({ proUntil, plan: "pro" }).where(eq(users.id, payment.userId));
    return { ok: true, payment: updated, proUntil, alreadyApplied: false } as const;
  });
}

export async function markPaymentFailed(db: Db, reference: string) {
  await db
    .update(payments)
    .set({ status: "failed" })
    .where(and(eq(payments.reference, reference), eq(payments.status, "pending")));
}
