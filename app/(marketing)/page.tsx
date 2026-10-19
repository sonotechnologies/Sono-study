import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { InstallButton } from "@/components/marketing/install-button";
import { buttonClass } from "@/components/ui/primitives";
import { SCHOOLS } from "@/db/schools-list";
import { authEnabled, demoMode } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/format";
import { PASSES, PLANS } from "@/lib/plans";
import { getViewerId } from "@/lib/viewer";

export const metadata: Metadata = {
  title: { absolute: "Sono Study · Upload your notes. Practise like the real CBT." },
  description: "Turn lecture notes into timed CBT mocks, flashcards and a tutor that cites the page. Built for Nigerian universities, polys and colleges.",
};

const HOW = [
  ["Upload your notes", "Photos of handwritten notes, slides, PDFs. Or start from your class's shared bank."],
  ["Take a timed mock", "The same layout as your CBT centre: question, A–E, timer, navigator. Just cleaner."],
  ["Fix your weak topics", "See exactly which topics cost you marks, then drill just those until they turn green."],
] as const;

const FEATURES = [
  ["CBT-style mocks", "Timer, navigator, flagging and a submit check, just like exam day."],
  ["Topic mastery", "Every course broken into topics, each one weak, shaky, good or mastered."],
  ["Flashcards that space themselves", "Rate a card and it comes back right before you forget it."],
  ["Tutor with page references", "Answers from your notes, citing the slide or page so you can check."],
  ["Theory grading", "Write an essay answer, see what you covered and what you missed."],
  ["Class leaderboards", "Weekly boards and Friday challenges with your coursemates."],
] as const;

const FAQ = [
  ["Are the questions like the real exam?", "Mocks use your own notes plus shared banks from your school, in the same A–E, timed format as campus CBT centres."],
  ["Does it work without data?", "Yes. Once a mock has opened, you can finish it with no connection. Your answers are saved on the phone and sync when you reconnect."],
  ["Who sees my uploads?", "Your files are only ever visible to you. If you leave “Share with your class” on, the questions made from them join your class bank; turn it off and they stay yours."],
  ["Is it a subscription?", "No. Passes are one-off payments through Paystack and never auto-renew."],
  ["Can I study anonymously?", "Yes. Pick a handle or appear as an anonymous animal on leaderboards."],
] as const;

const FREE = PLANS.free;
const PRO = PLANS.pro;
const SHOWCASE = ["UNILAG", "UI", "OAU", "UNN", "ABU", "LASU"];
const universities = Math.floor(SCHOOLS.filter((s) => s.type === "university").length / 10) * 10;

const H2 = "m-0 font-display text-[32px] font-bold leading-tight tracking-[-0.02em] lg:text-[44px]";
const SECTION = "border-t border-border px-4 py-14 sm:px-8 lg:px-20 lg:py-20";

/** Landing page (design 4a). Signed-in students go straight to Home. */
export default async function Landing() {
  if (authEnabled && (await getViewerId())) redirect("/home");
  const start = authEnabled || !demoMode ? "/login" : "/home";

  return (
    <div className="min-h-dvh bg-bg">
      <nav className="flex h-[72px] items-center gap-4 whitespace-nowrap border-b border-border px-4 sm:px-8 lg:gap-10 lg:px-20">
        <Link href="/" aria-label="Sono Study home">
          <Logo className="[&>span:last-child]:text-lg sm:[&>span:last-child]:text-xl" />
        </Link>
        <div className="hidden flex-1 gap-7 text-[15px] text-ink-muted md:flex">
          <a href="#how-it-works" className="hover:text-ink">How it works</a>
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
        </div>
        <span className="flex-1 md:hidden" />
        <Link href="/login" className="text-[15px] font-semibold">
          Log in
        </Link>
        <Link href={start} className={buttonClass("primary", "md", "h-11 px-4 text-[15px] sm:px-5")}>
          Start free
        </Link>
      </nav>

      <main>
        <section className="grid items-center gap-12 px-4 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-20 lg:pb-20 lg:pt-24">
          <div className="flex flex-col gap-6 lg:gap-7">
            <span className="flex h-8 items-center gap-2 self-start rounded-full border border-border px-3.5 text-[14px] text-ink-muted">
              <span className="size-2 rounded-full bg-spark" aria-hidden />
              Courses ready for {universities}+ Nigerian universities
            </span>
            <h1 className="m-0 text-balance font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[56px] lg:text-[72px]">
              Upload your notes. Practise like the real CBT.
            </h1>
            <p className="m-0 max-w-[560px] text-pretty text-[17px] leading-relaxed text-ink-muted lg:text-xl">
              Snap your lecture notes or drop the slides. Sono Study turns them into timed mocks, flashcards and a tutor that cites the page. Works on any
              phone, even offline.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={start} className={buttonClass("primary", "lg", "h-14 px-7 text-[17px]")}>
                Start free
              </Link>
              <Link href={start} className={buttonClass("secondary", "lg", "h-14 px-6 text-[17px]")}>
                Try a GST 111 mock
              </Link>
            </div>
            <span className="text-[14px] text-ink-muted">
              Free: {FREE.uploadsPerDay} uploads and {FREE.aiQuestionsPerDay} new questions a day. Mocks are unlimited. No card needed.
            </span>
          </div>
          <PhoneMock />
        </section>

        <section aria-label="Schools" className="flex flex-col items-center gap-5 px-4 pb-16 sm:px-8 lg:px-20 lg:pb-[72px]">
          <span className="text-[14px] text-ink-muted">Your school&apos;s courses are already set up</span>
          <ul className="grid w-full max-w-[1040px] grid-cols-3 gap-3 sm:grid-cols-6 lg:gap-4">
            {SHOWCASE.map((s) => (
              <li key={s} className="grid h-14 place-items-center rounded-[12px] border border-border font-display text-[15px] font-semibold text-ink-muted">
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section id="how-it-works" className={cn(SECTION, "flex scroll-mt-4 flex-col gap-10 lg:gap-12")}>
          <h2 className={H2}>How it works</h2>
          <ol className="grid gap-4 md:grid-cols-3 lg:gap-6">
            {HOW.map(([title, body], i) => (
              <li key={title} className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-6 lg:p-7">
                <span className="font-display text-[40px] font-bold leading-none text-accent">{i + 1}</span>
                <span className="font-display text-[22px] font-bold">{title}</span>
                <span className="text-base leading-relaxed text-ink-muted">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className={cn(SECTION, "grid scroll-mt-4 gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16")}>
          <div className="flex flex-col gap-4">
            <h2 className={H2}>Everything you need before exam week</h2>
            <span className="text-[17px] leading-relaxed text-ink-muted">Built for cheap phones and slow data. Mocks keep working offline.</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(([title, body]) => (
              <div key={title} className="flex flex-col gap-2 border-t border-border pt-5">
                <h3 className="m-0 font-display text-xl font-bold">{title}</h3>
                <span className="text-[15px] leading-relaxed text-ink-muted">{body}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className={cn(SECTION, "flex scroll-mt-4 flex-col items-center gap-10")}>
          <div className="flex flex-col items-center gap-2.5 text-center">
            <h2 className={H2}>Pay once. No subscription.</h2>
            <span className="text-[17px] text-ink-muted">Start free. Upgrade when exams get close.</span>
          </div>
          <div className="grid w-full max-w-[1000px] gap-5 md:grid-cols-3">
            <PriceCard
              name="Free"
              price="₦0"
              lines={[`${FREE.uploadsPerDay} uploads a day, ${FREE.pagesPerUpload} pages each`, `${FREE.aiQuestionsPerDay} new questions a day`, "Unlimited mocks, flashcards and shared banks", `${FREE.tutorMessagesPerDay} tutor messages a day`]}
              cta="Start free"
              href={start}
            />
            <PriceCard
              name={PASSES.week.name}
              price={formatNaira(PASSES.week.amountKobo)}
              per={`/ ${PASSES.week.days} days`}
              lines={[`${PRO.uploadsPerDay} uploads a day, ${PRO.pagesPerUpload} pages each`, `${PRO.tutorMessagesPerDay} tutor messages a day`, `${PRO.theoryGradingsPerDay} theory gradings a day`, "Skip the queue"]}
              cta={`Get ${PASSES.week.name}`}
              href={start}
            />
            <PriceCard
              name={PASSES.semester.name}
              price={formatNaira(PASSES.semester.amountKobo)}
              per="/ semester"
              lines={[`Everything in ${PASSES.week.name}`, `${PASSES.semester.days} days, the whole semester`, `About ${formatNaira(Math.round(PASSES.semester.amountKobo / (PASSES.semester.days / 7) / 10_000) * 10_000)} a week`]}
              cta={`Get ${PASSES.semester.name}`}
              href={start}
              best
            />
          </div>
          <span className="text-center text-[14px] text-ink-muted">Pay with card, bank transfer or USSD via Paystack.</span>
        </section>

        <section id="faq" className={cn(SECTION, "grid scroll-mt-4 gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16")}>
          <h2 className={H2}>FAQ</h2>
          <div className="flex flex-col">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group border-t border-border py-5 lg:py-[22px]">
                <summary className="flex cursor-pointer list-none justify-between gap-4 text-[17px] font-semibold lg:text-lg [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="text-xl font-normal text-ink-muted">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="mb-0 mt-2 max-w-[680px] text-base leading-relaxed text-ink-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-4 mb-14 flex flex-col gap-6 rounded-3xl bg-accent p-7 text-on-accent sm:mx-8 lg:mx-20 lg:mb-20 lg:flex-row lg:items-center lg:gap-10 lg:p-14">
          <div className="flex flex-1 flex-col gap-2.5">
            <h2 className="m-0 font-display text-[28px] font-bold leading-tight lg:text-[40px]">Add Sono Study to your home screen</h2>
            <span className="text-[17px] leading-normal">Opens like an app, uses less data, and your mocks work offline.</span>
          </div>
          <InstallButton />
        </section>
      </main>

      <footer className="flex flex-col justify-between gap-2 border-t border-border px-4 py-8 text-[14px] text-ink-muted sm:flex-row sm:px-8 lg:px-20">
        <span>Sono Study · part of Sono Education</span>
        <a href={`mailto:${process.env.SUPPORT_EMAIL || "support@sono.study"}`} className="hover:text-ink">
          Contact
        </a>
      </footer>
    </div>
  );
}

function PriceCard({ name, price, per, lines, cta, href, best }: { name: string; price: string; per?: string; lines: string[]; cta: string; href: string; best?: boolean }) {
  return (
    <div className={cn("relative flex flex-col gap-4 rounded-2xl p-7", best ? "border-2 border-accent bg-accent-soft p-[27px]" : "border border-border bg-surface")}>
      {best && <span className="absolute -top-[13px] left-[27px] grid h-[26px] place-items-center rounded-full bg-spark px-2.5 text-[12px] font-bold text-[#0B0D17]">Best value</span>}
      <h3 className="m-0 text-base font-semibold">{name}</h3>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[44px] font-bold leading-none">{price}</span>
        {per && <span className="text-ink-muted">{per}</span>}
      </div>
      <ul className="m-0 flex list-none flex-col p-0 text-[15px] leading-[1.7] text-ink-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <Link href={href} className={buttonClass(best ? "primary" : "secondary", "md", "mt-auto h-12 text-[15px]")}>
        {cta}
      </Link>
    </div>
  );
}

/** The hero phone: a frozen GST 111 mock question, drawn with the app's own tokens. */
function PhoneMock() {
  const options = [
    ["A", "was"],
    ["B", "were"],
    ["C", "is"],
    ["D", "has been"],
  ] as const;
  return (
    <div aria-hidden className="relative hidden justify-center sm:flex">
      <div className="absolute top-[60px] size-[420px] rounded-full bg-accent-soft" />
      <div className="relative flex h-[660px] w-[320px] flex-col overflow-hidden rounded-[40px] border-8 border-surface-2 bg-surface">
        <div className="mt-4 flex h-[52px] items-center justify-between border-b border-border px-3.5">
          <span className="text-[14px] font-semibold">GST 111 · Mock</span>
          <span className="flex h-[30px] items-center rounded-full bg-surface-2 px-2.5 font-display text-[14px] font-bold">18:42</span>
        </div>
        <div className="h-[3px] bg-surface-2">
          <div className="h-full w-[23%] bg-accent" />
        </div>
        <div className="flex flex-col gap-3.5 px-4 py-[18px]">
          <span className="font-display text-[13px] font-bold text-ink-muted">Question 7 of 30</span>
          <span className="text-[15px] leading-relaxed">Neither the lecturer nor the students ______ aware of the change of venue.</span>
          <div className="flex flex-col gap-[7px]">
            {options.map(([letter, text]) => {
              const picked = letter === "B";
              return (
                <div
                  key={letter}
                  className={cn("flex h-[46px] items-center gap-2.5 rounded-[12px] px-3 text-[15px]", picked ? "border border-accent bg-accent-soft font-medium" : "bg-surface-2")}
                >
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-[12px]",
                      picked ? "bg-accent font-bold text-on-accent" : "border-[1.5px] border-ink-muted font-semibold text-ink-muted",
                    )}
                  >
                    {letter}
                  </span>
                  {text}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-auto flex gap-2 border-t border-border px-3.5 pb-[18px] pt-3">
          <span className="size-11 rounded-[12px] bg-surface-2" />
          <span className="flex-1" />
          <span className="grid h-11 place-items-center rounded-[12px] bg-accent px-5 text-[14px] font-semibold text-on-accent">Next</span>
        </div>
      </div>
    </div>
  );
}
