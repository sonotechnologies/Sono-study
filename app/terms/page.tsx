import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, supportEmail } from "@/components/marketing/legal-page";
import { formatNaira } from "@/lib/format";
import { PASSES } from "@/lib/plans";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  const email = supportEmail();
  return (
    <LegalPage title="Terms of Use" updated="3 November 2026">
      <p>
        These terms are the agreement between you and Sono Education (&ldquo;we&rdquo;, &ldquo;us&rdquo;) for using Sono Study. By creating an account or using the
        app, you agree to them. Please also read our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Using Sono Study</h2>
      <ul>
        <li>Sono Study is a study tool for students. If you are under 18, use it only with a parent or guardian&apos;s permission.</li>
        <li>Give accurate details, keep one account for yourself, and keep your sign-in secure. You&apos;re responsible for what happens on your account.</li>
        <li>
          Sono Study is not run by, or connected to, your school, JAMB, WAEC or any examining body. Mocks and marks are practice, not official results.
        </li>
      </ul>

      <h2>Your uploads</h2>
      <ul>
        <li>You keep ownership of what you upload. You give us permission to store it and process it (including with AI services) to provide Sono Study to you.</li>
        <li>
          Only upload material you are allowed to use for your own study, such as your lecture notes and slides. Don&apos;t upload other people&apos;s personal data
          or anything illegal or offensive.
        </li>
        <li>
          If you share with your class, you allow classmates at your school to use the questions and flashcards made from your upload. Turning sharing off stops
          new classmates seeing them.
        </li>
        <li>We may remove content that breaks these terms, or questions reported by students as wrong or inappropriate.</li>
      </ul>

      <h2>AI-made content</h2>
      <p>
        Questions, answers, explanations, flashcards, tutor replies and theory marks are made by AI from the notes available. They can be wrong or incomplete.
        Check important points against your notes or with your lecturer. You can report a wrong question from the app.
      </p>

      <h2>Fair use</h2>
      <p>Don&apos;t:</p>
      <ul>
        <li>use Sono Study to help anyone during a real exam or test (the tutor declines these requests)</li>
        <li>claim a payment you haven&apos;t made, or try to get around daily limits</li>
        <li>copy the question banks in bulk, scrape the app, or attack, overload or reverse-engineer it</li>
        <li>harass other students or misuse leaderboards and challenges</li>
      </ul>
      <p>We may limit, suspend or close accounts that do these things.</p>

      <h2>Plans and passes</h2>
      <ul>
        <li>The Free plan has daily limits shown in the app. Mocks, flashcards and shared banks are not limited.</li>
        <li>
          Passes are one-off payments, not subscriptions: the {PASSES.week.name} is {formatNaira(PASSES.week.amountKobo)} for {PASSES.week.days} days and the{" "}
          {PASSES.semester.name} is {formatNaira(PASSES.semester.amountKobo)} for {PASSES.semester.days} days. They never renew automatically. A new pass adds to any
          time you have left.
        </li>
        <li>
          When paying by transfer, send the exact amount shown, with the payment code in the note if you can. Your pass starts when you tap &ldquo;I&apos;ve
          sent it&rdquo;. If we can&apos;t find your transfer within 24 hours, the pass is switched off until it arrives. Claiming a payment you didn&apos;t make
          may lead to your account being closed.
        </li>
        <li>
          If you paid but your pass didn&apos;t start, or you paid twice by mistake, email us within 7 days with your receipt and we&apos;ll fix it or refund you.
          Otherwise passes aren&apos;t refundable once started, except where the law says they must be.
        </li>
        <li>We may change prices and limits for future passes. A pass you&apos;ve already bought keeps the terms it was sold with.</li>
      </ul>

      <h2>The service</h2>
      <p>
        We work to keep Sono Study available and your data safe, but we can&apos;t promise it will always be available or error-free. We may change or stop features,
        and will give notice of important changes where we can.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in Profile. We may suspend or close an account that breaks these terms. Questions you shared with your class may stay
        in the class bank without your name.
      </p>

      <h2>Liability</h2>
      <p>
        As far as the law allows, we aren&apos;t responsible for exam results or for losses that come from relying on AI-made content, and our total liability to you
        is limited to what you paid us in the 3 months before the claim. Nothing in these terms limits rights you have under Nigerian consumer protection law.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. If we update them, we&apos;ll tell you in the app before the changes apply. Questions?
        Email <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </LegalPage>
  );
}
