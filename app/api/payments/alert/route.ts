import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { formatNaira } from "@/lib/format";
import { notifyOnce } from "@/lib/push";
import { recordAlert, type AlertInput } from "@/lib/transfers";

export const dynamic = "force-dynamic";

function authorised(req: NextRequest): boolean {
  const secret = process.env.PAYMENT_ALERT_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  return null;
};

/** Reads whatever shape the phone's forwarder sends: JSON, a form, or plain text. */
async function readAlert(req: NextRequest): Promise<AlertInput | null> {
  const type = req.headers.get("content-type") ?? "";
  let fields: Record<string, unknown> = {};
  if (type.includes("json")) fields = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  else if (type.includes("form")) fields = Object.fromEntries(await req.formData());
  else fields = { text: await req.text() };
  const text = pick(fields, "text", "message", "body", "content", "msg", "sms");
  if (!text?.trim()) return null;
  // ?app=opay in the URL tells plain-text forwarders apart.
  const app = pick(fields, "app", "package", "packageName", "from", "sender") ?? req.nextUrl.searchParams.get("app");
  return { app, title: pick(fields, "title", "subject"), text: text.trim() };
}

/**
 * Credit alerts forwarded from the phone signed in to Sono's OPay / PalmPay apps
 * (README: "Getting paid by OPay and PalmPay"). Protected by PAYMENT_ALERT_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!authorised(req)) return new NextResponse("Unauthorized", { status: 401 });
  const input = await readAlert(req);
  if (!input) return NextResponse.json({ status: "empty" }, { status: 400 });
  const db = await getDb();
  const result = await recordAlert(db, input);
  if (result.status === "matched") {
    await notifyOnce(db, result.payment.userId, "payment", result.payment.id, {
      title: "Payment confirmed",
      body: `We got your ${formatNaira(result.payment.transferAmountKobo ?? result.payment.amountKobo)}. Your pass is all set.`,
      url: "/profile",
      tag: "payment",
    }).catch(() => {});
  }
  return NextResponse.json({
    status: result.status,
    ...(result.status !== "duplicate" && { amount: result.alert.amountKobo, code: result.alert.code, source: result.alert.source }),
    ...(result.status === "matched" && { payment: result.payment.code }),
  });
}
