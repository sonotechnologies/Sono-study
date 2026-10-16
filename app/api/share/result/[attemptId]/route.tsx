import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getResult } from "@/lib/exam-engine/service";
import { formatScore } from "@/lib/exam-engine/results";
import { displayCourseCode, formatClock } from "@/lib/format";
import { inviteUrl } from "@/lib/invite";
import { ogFonts } from "@/lib/og-fonts";
import { getViewerId } from "@/lib/viewer";

/** 3h — 1080×1920 story card for a mock result. Always dark, whatever the app theme. */
export async function GET(_req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const userId = await getViewerId();
  if (!userId) return new Response("Sign in first", { status: 401 });
  const { attemptId } = await ctx.params;
  const db = await getDb();
  const r = await getResult(db, userId, attemptId);
  if (!r) return new Response("Not found", { status: 404 });
  const [user] = await db.select({ referralCode: users.referralCode, handle: users.handle, streakDays: users.streakDays }).from(users).where(eq(users.id, userId));
  const code = user.referralCode ?? user.handle ?? userId;
  const [fonts, qr] = await Promise.all([
    ogFonts(),
    QRCode.toDataURL(inviteUrl(code), { margin: 1, width: 200, color: { dark: "#EEF0FA", light: "#141726" } }),
  ]);
  const a = r.attempt;
  const score = a.score ?? 0;
  const newBest = r.prevBest !== null && score > r.prevBest;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1920,
          background: "#0B0D17",
          color: "#EEF0FA",
          padding: "120px 96px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="88" height="88" viewBox="0 0 48 48">
            <circle cx="24" cy="32" r="13" fill="#8B7CFF" />
            <path d="M12 14L24 4l12 10" fill="none" stroke="#C6F24E" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: "Space Grotesk", fontSize: 64, fontWeight: 700 }}>Sono Study</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {newBest && (
            <span style={{ alignSelf: "flex-start", padding: "16px 32px", borderRadius: 999, border: "4px solid #C6F24E", color: "#C6F24E", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 40, letterSpacing: 2 }}>
              NEW BEST
            </span>
          )}
          <span style={{ fontSize: 56, fontWeight: 600, color: "#9499B5" }}>{displayCourseCode(r.courseCode)} {a.mode === "challenge" ? "challenge" : "mock"}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontFamily: "Space Grotesk", fontSize: 340, fontWeight: 700, lineHeight: 0.9, letterSpacing: -10 }}>{formatScore(score)}</span>
            <span style={{ fontFamily: "Space Grotesk", fontSize: 140, fontWeight: 700, color: "#9499B5" }}>/{formatScore(a.maxScore ?? 0)}</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <span style={{ padding: "24px 36px", borderRadius: 32, background: "#141726", fontSize: 44, fontWeight: 600, color: "#C6F24E" }}>{user.streakDays}-day streak</span>
            <span style={{ padding: "24px 36px", borderRadius: 32, background: "#141726", fontSize: 44, fontWeight: 600 }}>{formatClock(r.timeSec)}</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "3px solid #262B42", paddingTop: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 48, fontWeight: 600 }}>Practise with me</span>
            <span style={{ fontSize: 40, color: "#8B7CFF" }}>{inviteUrl(code, { display: true })}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={200} height={200} alt="" style={{ borderRadius: 24 }} />
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts, headers: { "Cache-Control": "private, max-age=300" } },
  );
}
