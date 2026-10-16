import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { demoMode } from "@/lib/auth";
import { DEV_USER_COOKIE } from "@/lib/viewer";

/** Demo mode only (never with real sign-in): start onboarding as a brand-new student. /dev/new-student?reset=1 goes back to the demo student. */
export async function GET(req: Request) {
  if (!demoMode) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  if (url.searchParams.get("reset")) {
    const res = NextResponse.redirect(new URL("/home", req.url));
    res.cookies.delete(DEV_USER_COOKIE);
    return res;
  }
  const id = `dev-${crypto.randomUUID().slice(0, 8)}`;
  const db = await getDb();
  await db.insert(users).values({ id, name: "Chioma Eze", email: `${id}@example.com` });
  const res = NextResponse.redirect(new URL("/onboarding", req.url));
  res.cookies.set(DEV_USER_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
