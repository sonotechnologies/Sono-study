import { describe, expect, it } from "vitest";
import { canUse, limitFor, PASSES, planSummary, remainingFor } from "@/lib/plans";
import { effectivePlan, extendProUntil, newPaymentReference, weeklyCostNaira } from "@/lib/billing";
import { lagosDate, nextDailyReset, weekStart } from "@/lib/time";
import { formatClock, formatCountdown, formatHms, formatNaira, initials, ordinal } from "@/lib/format";
import { anonymousName, normaliseHandle, publicName } from "@/lib/identity";
import { compareResults } from "@/lib/leaderboard";
import { challengeReward, topPercent } from "@/lib/challenges";
import { isValidWebhookSignature } from "@/lib/paystack";
import { createHmac } from "node:crypto";

describe("plan limits", () => {
  it("matches the build brief table", () => {
    expect(limitFor("free", "upload")).toBe(2);
    expect(limitFor("pro", "upload")).toBe(15);
    expect(limitFor("free", "ai_questions")).toBe(40);
    expect(limitFor("pro", "ai_questions")).toBe(400);
    expect(limitFor("free", "tutor_message")).toBe(10);
    expect(limitFor("pro", "theory_grading")).toBe(30);
  });
  it("counts what's left and blocks at the limit", () => {
    expect(remainingFor("free", "upload", 1)).toBe(1);
    expect(remainingFor("free", "upload", 5)).toBe(0);
    expect(canUse("free", "upload", 1)).toBe(true);
    expect(canUse("free", "upload", 2)).toBe(false);
    expect(canUse("free", "ai_questions", 30, 20)).toBe(false);
  });
  it("prices passes in kobo", () => {
    expect(PASSES.week.amountKobo).toBe(50_000);
    expect(PASSES.semester.amountKobo).toBe(200_000);
    expect(planSummary("free")).toBe("2 uploads and 40 AI questions a day");
  });
});

describe("billing", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("is pro only while proUntil is in the future", () => {
    expect(effectivePlan({ proUntil: null }, now)).toBe("free");
    expect(effectivePlan({ proUntil: new Date("2026-10-16T11:59:59Z") }, now)).toBe("free");
    expect(effectivePlan({ proUntil: new Date("2026-10-17T00:00:00Z") }, now)).toBe("pro");
  });
  it("stacks passes from the later of now and the current expiry", () => {
    expect(extendProUntil(null, "week", now).toISOString()).toBe("2026-10-23T12:00:00.000Z");
    expect(extendProUntil(new Date("2026-10-01T00:00:00Z"), "week", now).toISOString()).toBe("2026-10-23T12:00:00.000Z");
    expect(extendProUntil(new Date("2026-10-20T12:00:00Z"), "semester", now).toISOString()).toBe("2027-03-19T12:00:00.000Z");
  });
  it("rounds weekly cost for copy", () => {
    expect(weeklyCostNaira("semester")).toBe(100);
    expect(weeklyCostNaira("week")).toBe(500);
  });
  it("makes unique references", () => {
    const refs = new Set(Array.from({ length: 200 }, newPaymentReference));
    expect(refs.size).toBe(200);
    expect([...refs][0]).toMatch(/^SONO-[A-Z2-9]{8}-[A-Z2-9]{2}$/);
  });
  it("verifies Paystack webhook signatures", () => {
    const body = JSON.stringify({ event: "charge.success" });
    const sig = createHmac("sha512", "sk_test").update(body).digest("hex");
    expect(isValidWebhookSignature(body, sig, "sk_test")).toBe(true);
    expect(isValidWebhookSignature(body + " ", sig, "sk_test")).toBe(false);
    expect(isValidWebhookSignature(body, "abc", "sk_test")).toBe(false);
    expect(isValidWebhookSignature(body, null, "sk_test")).toBe(false);
  });
});

describe("Lagos time", () => {
  it("uses WAT (UTC+1) day boundaries", () => {
    expect(lagosDate(new Date("2026-10-16T22:59:00Z"))).toBe("2026-10-16");
    expect(lagosDate(new Date("2026-10-16T23:00:00Z"))).toBe("2026-10-17");
    expect(nextDailyReset(new Date("2026-10-16T12:00:00Z")).toISOString()).toBe("2026-10-16T23:00:00.000Z");
  });
  it("starts weeks on Monday", () => {
    expect(weekStart(new Date("2026-10-16T12:00:00Z"))).toBe("2026-10-12"); // Friday
    expect(weekStart(new Date("2026-10-18T22:30:00Z"))).toBe("2026-10-12"); // Sunday 23:30 WAT
    expect(weekStart(new Date("2026-10-18T23:00:00Z"))).toBe("2026-10-19"); // Monday 00:00 WAT
  });
});

describe("formatting", () => {
  it("formats money, clocks and countdowns", () => {
    expect(formatNaira(200_000)).toBe("₦2,000");
    expect(formatClock(1180)).toBe("19:40");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatCountdown(((1 * 24 + 4) * 60 + 12) * 60_000 + 30_000)).toBe("1d 04h 12m");
    expect(formatCountdown(65 * 60_000)).toBe("01h 05m");
    expect(formatHms(((6 * 60 + 54) * 60 + 10) * 1000)).toBe("06:54:10");
    expect(initials("Tolu Okafor")).toBe("TO");
    expect(initials("@ada_reads")).toBe("AR");
    expect(initials("@seun")).toBe("SE");
    expect(ordinal(18)).toBe("18th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(112)).toBe("112th");
  });
});

describe("identity", () => {
  it("gives stable anonymous names and validates handles", () => {
    expect(anonymousName("u1")).toBe(anonymousName("u1"));
    expect(anonymousName("u1")).toMatch(/^Anonymous [a-z]+$/);
    expect(publicName({ id: "u1", handle: "tolu", anonymous: false })).toBe("@tolu");
    expect(publicName({ id: "u1", handle: "tolu", anonymous: true })).toBe(anonymousName("u1"));
    expect(normaliseHandle(" @Tolu.O ")).toBe("tolu.o");
    expect(normaliseHandle("a")).toBeNull();
    expect(normaliseHandle("bad handle")).toBeNull();
    expect(normaliseHandle("_x_")).toBeNull();
  });
});

describe("ranking", () => {
  it("ranks by score ratio, then time", () => {
    const a = { score: 28, maxScore: 30, timeSec: 900 };
    const b = { score: 28, maxScore: 30, timeSec: 800 };
    const c = { score: 19, maxScore: 20, timeSec: 2000 };
    expect([a, b, c].sort(compareResults)).toEqual([c, b, a]);
  });
  it("rewards challenge placings", () => {
    expect(challengeReward(6, 212)).toEqual({ xp: 150, badge: "Top 10" });
    expect(challengeReward(2, 212).badge).toBe("Podium");
    expect(challengeReward(40, 212)).toEqual({ xp: 75, badge: null });
    expect(challengeReward(150, 212)).toEqual({ xp: 25, badge: null });
    expect(topPercent(6, 212)).toBe(3);
    expect(topPercent(1, 1000)).toBe(1);
  });
});
