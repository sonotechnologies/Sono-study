import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, users } from "@/db/schema";
import { getChallenge, getClosedChallengeResult } from "@/lib/challenges";
import { displayCourseCode, formatClock } from "@/lib/format";
import { ogFonts } from "@/lib/og-fonts";
import { getViewerId } from "@/lib/viewer";
import { inviteUrl } from "@/lib/invite";

/** 3i — square 1080×1080 challenge rank card. Always accent/dark, whatever the app theme. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewerId = await getViewerId();
  if (!viewerId) return new Response("Sign in first", { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  const challenge = await getChallenge(db, id);
  if (!challenge || challenge.endsAt > new Date()) return new Response("Not found", { status: 404 });
  const result = await getClosedChallengeResult(db, challenge, viewerId, 1);
  if (!result.viewer) return new Response("You didn't take this challenge", { status: 404 });
  const [[course], [user]] = await Promise.all([
    db.select({ code: courses.code }).from(courses).where(eq(courses.id, challenge.courseId)),
    db.select({ referralCode: users.referralCode, handle: users.handle }).from(users).where(eq(users.id, viewerId)),
  ]);
  const link = inviteUrl(user.referralCode ?? user.handle ?? viewerId, { display: true });
  const [fonts, qr] = await Promise.all([
    ogFonts(),
    QRCode.toDataURL(inviteUrl(user.referralCode ?? user.handle ?? viewerId), { margin: 1, width: 168, color: { dark: "#8B7CFF", light: "#0B0D17" } }),
  ]);
  const display = "Space Grotesk";
  const v = result.viewer;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          background: "#8B7CFF",
          color: "#0B0D17",
          padding: 88,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="72" height="72" viewBox="0 0 48 48">
              <circle cx="24" cy="32" r="13" fill="#0B0D17" />
              <path d="M12 14L24 4l12 10" fill="none" stroke="#0B0D17" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: display, fontSize: 52, fontWeight: 700 }}>Sono Study</span>
          </div>
          <span style={{ fontSize: 40, fontWeight: 600 }}>{displayCourseCode(course.code)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: 48, fontWeight: 600 }}>{challenge.title}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontFamily: display, fontSize: 300, fontWeight: 700, lineHeight: 0.85, letterSpacing: -9 }}>#{v.rank}</span>
            <span style={{ fontSize: 56, fontWeight: 600 }}>of {result.total}</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 44, fontWeight: 600 }}>
              {v.score}/{v.maxScore} · {formatClock(v.timeSec)}
            </span>
            <span style={{ fontSize: 36 }}>{link}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={168} height={168} alt="" style={{ borderRadius: 20 }} />
        </div>
      </div>
    ),
    { width: 1080, height: 1080, fonts, headers: { "Cache-Control": "private, max-age=300" } },
  );
}
