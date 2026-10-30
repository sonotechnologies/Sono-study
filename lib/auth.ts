import NextAuth, { type NextAuthConfig } from "next-auth";
import { cookies } from "next/headers";
import { eq, or } from "drizzle-orm";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { REFERRAL_COOKIE } from "./invite";

export const hasGoogle = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const hasEmail = Boolean(process.env.AUTH_RESEND_KEY);

/** Real sign-in is on once a secret and at least one provider are configured. */
export const authEnabled = Boolean(process.env.AUTH_SECRET) && (hasGoogle || hasEmail);

/**
 * Without auth configured, local dev runs as the seeded demo student so every
 * screen works with zero setup. Never in production unless explicitly allowed.
 */
export const demoMode = !authEnabled && (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO === "1");

export const { handlers, auth, signIn, signOut } = NextAuth(async (): Promise<NextAuthConfig> => {
  const db = await getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    providers: [
      ...(hasGoogle ? [Google] : []),
      ...(hasEmail ? [Resend({ from: process.env.AUTH_EMAIL_FROM ?? "Sono Study <login@sono.study>" })] : []),
    ],
    session: { strategy: "database" },
    pages: { signIn: "/login", verifyRequest: "/login?sent=1" },
    events: {
      /** New student: give them a referral code and credit whoever invited them. */
      async createUser({ user }) {
        if (!user.id) return;
        const code = user.id.replace(/-/g, "").slice(0, 10);
        let referredById: string | null = null;
        try {
          const ref = (await cookies()).get(REFERRAL_COOKIE)?.value;
          if (ref) {
            const [inviter] = await db
              .select({ id: users.id })
              .from(users)
              .where(or(eq(users.referralCode, ref), eq(users.handle, ref)));
            if (inviter && inviter.id !== user.id) referredById = inviter.id;
          }
        } catch {
          // No request cookies available; skip attribution.
        }
        await db.update(users).set({ referralCode: code, referredById }).where(eq(users.id, user.id));
      },
    },
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  };
});
