import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, supportEmail } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

/** Privacy Policy, written for the Nigeria Data Protection Act 2023 (NDPA). */
export default function PrivacyPage() {
  const email = supportEmail();
  return (
    <LegalPage title="Privacy Policy" updated="3 November 2026">
      <p>
        Sono Study is run by Sono Education (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what we collect when you use Sono Study, why, who we share it with and the
        choices you have. We are the data controller for your personal data under the Nigeria Data Protection Act 2023 (NDPA).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name and email (from Google or an email sign-in link), your handle, school, department, level and courses, and your
          settings (theme, reminders, whether you appear anonymously on leaderboards).
        </li>
        <li>
          <strong>Your study activity:</strong> mocks and answers, practice, flashcard reviews, tutor questions and answers, theory answers and their marks, XP,
          streaks and leaderboard positions.
        </li>
        <li>
          <strong>What you upload:</strong> the files and photos of notes or past questions you choose to upload, the text we read from them, and the questions,
          flashcards and marking guides made from them. Before that text is stored or sent to an AI service, we remove phone numbers, email addresses and matric
          numbers we find in it.
        </li>
        <li>
          <strong>Payments:</strong> the pass you bought, the amount, the payment code and time. When you pay by transfer, our OPay or PalmPay account&apos;s
          &ldquo;money received&rdquo; notification (amount and sender name) is matched to your payment. We never see your card or bank login details.
        </li>
        <li>
          <strong>Your device:</strong> if you turn on notifications, your browser&apos;s push subscription; and basic technical data (IP address, browser type) used
          to keep the service secure and to stop abuse.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run Sono Study for you: make questions and flashcards from your notes, mark answers, show your progress and plan, and keep your streak.</li>
        <li>To show your class leaderboards and weekly challenges, using your handle or an anonymous name if you choose.</li>
        <li>To process passes and confirm payments, and to stop fake payment claims.</li>
        <li>To send the reminders you switch on (you can turn each one off in Profile).</li>
        <li>To keep the service safe, fix problems and improve it.</li>
      </ul>
      <p>
        We rely on our agreement with you (to provide the service you signed up for), your consent (for notifications and for sharing questions with your class,
        which you can withdraw at any time), our legitimate interests (security, preventing abuse, improving Sono Study) and legal obligations (such as keeping
        payment records).
      </p>

      <h2>AI processing</h2>
      <p>
        To make questions, flashcards, marking guides and tutor answers, we send the relevant text from your notes (and, for photos, the images) to AI providers:
        Google (Gemini) and, as a backup, Groq. We don&apos;t send your name or email with it. Some free AI services may use what they receive to improve their
        products; we remove phone numbers, emails and matric numbers first, and we will move to paid plans that don&apos;t do this. AI output can be wrong: check it
        against your notes.
      </p>

      <h2>What your classmates see</h2>
      <ul>
        <li>
          If you leave &ldquo;Share with your class&rdquo; on, the questions and flashcards made from your upload join your course&apos;s class bank at your school.
          Your files and photos themselves are never shared.
        </li>
        <li>The tutor may answer a classmate from shared notes, showing &ldquo;Classmate&apos;s notes · page&rdquo;, never your name or your file.</li>
        <li>Leaderboards show your handle, or an anonymous name if you turn that on in Profile.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We don&apos;t sell your data. We use these service providers to run Sono Study, under contracts that limit how they use it:</p>
      <ul>
        <li>Vercel (hosting), Neon (database) and Cloudflare (file storage)</li>
        <li>Google (sign-in and Gemini AI), Groq (AI) and Resend (sign-in emails)</li>
        <li>OPay and PalmPay (as the accounts that receive transfers) and, if used, Paystack (card payments)</li>
      </ul>
      <p>
        Some of these providers store or process data outside Nigeria. Where they do, we rely on the safeguards the NDPA allows, such as contractual protections. We
        may also share data if the law requires it, or to protect our users and service.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account, uploads and study history: until you delete your account.</li>
        <li>Payment records: as long as the law requires us to keep financial records.</li>
        <li>Security and abuse-prevention data: only as long as needed (request counters are cleared within minutes).</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under the NDPA you can:</p>
      <ul>
        <li>
          get a copy of your data: <strong>Profile → Export my data</strong>
        </li>
        <li>correct it: edit your details in Profile, or ask us</li>
        <li>
          delete your account and data: <strong>Profile → Delete account</strong>
        </li>
        <li>withdraw consent (turn off notifications or class sharing) and object to some uses of your data</li>
        <li>complain to the Nigeria Data Protection Commission (NDPC) if you think we have mishandled your data</li>
      </ul>
      <p>
        For anything else, email <a href={`mailto:${email}`}>{email}</a>. We reply within 30 days.
      </p>

      <h2>Under 18?</h2>
      <p>If you are under 18, please use Sono Study only with the permission of a parent or guardian.</p>

      <h2>Security</h2>
      <p>
        Your files are stored privately and opened only through short-lived links for you. Connections are encrypted. No system is perfectly secure, but we work to
        protect your data and will tell you and the NDPC if a breach puts you at risk, as the law requires.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in an important way, we&apos;ll tell you in the app before it takes effect. See also our <Link href="/terms">Terms</Link>.
      </p>
    </LegalPage>
  );
}
