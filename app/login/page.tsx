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
      <Link href="/" aria-label="Sono Study home" className="self-start">
        <Logo />
      </Link>
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
              <button className={buttonClass("primary", "lg", "w-full")}>
                {/* Google's "G" mark, as its sign-in branding asks */}
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="rounded-full bg-white p-[2px]">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continue with Google
              </button>
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
