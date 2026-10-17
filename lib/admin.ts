import { demoMode } from "@/lib/auth";

/** Admins: ADMIN_EMAILS (comma-separated). In local demo mode with no list set, everyone is (to try the page). */
export function isAdmin(user: { email: string | null }): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && list.includes(user.email.toLowerCase())) return true;
  return demoMode && !list.length;
}
