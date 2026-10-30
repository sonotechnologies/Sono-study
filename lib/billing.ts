import { PASSES, type PassProduct, type PlanName } from "./plans";
import { addDays } from "./time";

/** Pro is active while proUntil is in the future. */
export function effectivePlan(user: { proUntil: Date | null }, now: Date = new Date()): PlanName {
  return user.proUntil && user.proUntil.getTime() > now.getTime() ? "pro" : "free";
}

/** Passes stack: a new pass extends from the later of now and the current expiry. */
export function extendProUntil(current: Date | null, product: PassProduct, now: Date = new Date()): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return addDays(base, PASSES[product].days);
}

/** Rough weekly cost, rounded to the nearest ₦50 for paywall copy ("about ₦100/wk"). */
export function weeklyCostNaira(product: PassProduct): number {
  const pass = PASSES[product];
  const perWeek = pass.amountKobo / 100 / (pass.days / 7);
  return Math.max(50, Math.round(perWeek / 50) * 50);
}

/** Paystack-safe unique reference, e.g. "SONO-7Q2M81XA-K3". */
export function newPaymentReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `SONO-${chars.slice(0, 8)}-${chars.slice(8)}`;
}
