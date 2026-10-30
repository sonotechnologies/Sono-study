import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { authEnabled, demoMode, hasEmail, hasGoogle, signIn } from "@/lib/auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { getViewerId } from "@/lib/viewer";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  if (await getViewerId()) redirect("/home");

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-8 px-5 py-12">
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] font-bold leading-tight">Upload your notes. Practise like the real CBT.</h1>
        <p className="text-base text-ink-muted">Sign in to keep your streak, courses and mock history.</p>
      </div>

      {sp.sent ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-[15px]">Check your email for a sign-in link.</p>
      ) : authEnabled ? (
        <div className="flex flex-col gap-3">
          {hasGoogle && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/home" });
              }}
            >
              <button className={buttonClass("primary", "lg", "w-full")}>Continue with Google</button>
            </form>
          )}
          {hasEmail && (
            <form
              className="flex flex-col gap-2"
              action={async (form: FormData) => {
                "use server";
                const email = String(form.get("email") ?? "").trim().toLowerCase();
                try {
                  await checkRateLimit(await getDb(), "signIn", { userId: email, ip: await requestIp() });
                } catch {
                  redirect("/login?error=slow-down");
                }
                await signIn("resend", { email, redirectTo: "/home" });
              }}
            >
              <label htmlFor="email" className="text-sm text-ink-muted">
                Or get a sign-in link by email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="h-[52px] rounded-[12px] bg-surface-2 px-4 text-base outline-none focus-visible:outline-2 focus-visible:outline-accent"
              />
              <button className={buttonClass("secondary", "lg")}>Email me a link</button>
            </form>
          )}
          {sp.error && (
            <p role="alert" className="text-sm text-wrong">
              {sp.error === "slow-down" ? "Too many sign-in links asked for. Wait a minute and try again." : "Sign-in didn't work. Please try again."}
            </p>
          )}
        </div>
      ) : demoMode ? (
        <Link href="/home" className={buttonClass("primary", "lg")}>
          Continue as the demo student
        </Link>
      ) : (
        <p className="text-[15px] text-ink-muted">Sign-in isn&apos;t configured yet.</p>
      )}
    </main>
  );
}
