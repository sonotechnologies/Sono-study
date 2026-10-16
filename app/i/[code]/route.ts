import { NextResponse } from "next/server";
import { REFERRAL_COOKIE } from "@/lib/invite";

/** Invite links: remember who invited this student, then send them to sign up. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const res = NextResponse.redirect(new URL("/login", req.url));
  if (/^[a-z0-9._-]{2,40}$/i.test(code)) {
    res.cookies.set(REFERRAL_COOKIE, code.toLowerCase(), { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", path: "/" });
  }
  return res;
}
