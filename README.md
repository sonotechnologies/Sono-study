# Sono Study

AI exam-prep PWA for Nigerian university, polytechnic and college of education students: upload notes, practise timed CBT mocks, track weak topics.

- **Build brief:** the product spec this repo follows (milestones, data model, plans and limits).
- **Designs:** `design/` holds the Claude Design hand-off (HTML prototypes, design brief, chat transcript). Start with `design/project/design_handoff_sono_study/README.md`.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM on Neon Postgres (+ pgvector) · Auth.js (Google + email magic link) · Paystack.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

No setup needed: without `DATABASE_URL` the app starts an embedded Postgres (PGlite) in `.next/cache/pglite`, migrates it and seeds demo data, and without auth keys you're signed in as the demo student. Payments complete instantly in local dev when no Paystack key is set. `npm run db:reset-local` wipes the local database (it re-seeds on next start).

For a real setup copy `.env.example` to `.env.local`, then `npm run db:migrate && npm run db:seed`.

```bash
npm test           # unit + database tests (PGlite, no server needed)
npm run typecheck
npm run lint
```

## What's built

**Milestone 1 — Foundation** ✅
- **Onboarding** (`/onboarding`, designs 2a–2c), in four steps:
  1. School search over about 50 seeded Nigerian universities, polytechnics and colleges of education. It filters on the phone and matches "uni lag" → UNILAG. A missing school can be added and stays pending until reviewed.
  2. Name and handle. Anonymous is the default.
  3. Department, level and courses by code, with "Popular in 100L" suggestions from classmates.
  4. Optional exam dates and times.
- **Redirect:** students who haven't finished onboarding are sent there. Profile → School / Courses / Exam dates reopen the same screens to edit.
- **Acceptance check:** on a mid-range Android profile (4× CPU slowdown, slow 4G), a scripted student with realistic typing finishes in about 21 seconds. About 4 seconds of that is waiting on the app; the target is under 90.
- **PWA install:**
  - Manifest with 192, 512 and maskable PNG icons. Chrome reports no installability errors.
  - Service worker: pages use network-first with an offline copy, build assets are cached, and `/offline` is the fallback.
  - "Install Sono Study" card on Home: Chrome uses its install prompt, iPhone gets the Add to Home Screen hint.
  - Saved pages are cleared on sign-out and account deletion.
- **Also in place:**
  - Design tokens for dark and light themes, fonts, and the app shell (248px sidebar on desktop, bottom tab bar on phones).
  - The full data model from the brief (`db/schema.ts`, migrations in `db/migrations`).
  - Auth.js wiring, plus a demo mode for local dev.
  - Every plan limit and price in `lib/plans.ts`.

**Local testing tip:** in demo mode, `/dev/new-student` signs you in as a brand-new student so you can walk through onboarding. `/dev/new-student?reset=1` switches back to the demo student. The route is disabled whenever real sign-in is configured.

**Account screens** (designs 6a–6e desktop, 3a–3i phone)
| Route | What it does |
| --- | --- |
| `/leaderboard` | Weekly / all-time / department board per course, ranked by score then time. Your own row is pinned. Live challenge countdown with "Join · remind me". Last challenge result. |
| `/leaderboard/challenges/[id]` | Closed challenge: placing, Top %, XP and badge, class average, final standings, share. |
| `/api/share/challenge/[id]` | 1080×1080 share card (PNG) with invite link and QR. |
| `/profile` | Handle, anonymous toggle, notification toggles and reminder time, plan card, theme, data export, account deletion. |
| `?paywall=1` on any page | Paywall: bottom sheet on phones, modal on desktop. Paystack checkout. |
| `/billing/callback`, `/api/paystack/webhook`, `/billing/success` | Verify payments server-side and extend `proUntil`. Passes stack, and a payment is applied only once. |
| `/onboarding` | See Milestone 1 above. |
| `/upload` | Shows the daily-limit state when today's free uploads are used. Includes the invite link and WhatsApp share. |
| `/i/[code]` | Invite links. The inviter is recorded when the new student signs up. |
| `/dev/states` | Dev-only gallery of the queue, limit and payment states and the Home skeleton. |

The leaderboard and profile have static loading skeletons.

## Where the build differs from the designs

The build brief is the source of truth for product rules:
- **Free plan:** 2 uploads and 40 AI questions a day, with mocks unlimited. The design said "3 uploads and 2 mocks".
- **Referral reward:** inviting 3 classmates earns a free Week Pass. The design said "invite 2, get +5 uploads".
- **Leaderboard names:** anonymous by default.
- **Paywall copy:** "Go Pro" instead of "Go unlimited", because Pro has daily caps.
- **Semester Pass length:** 150 days from purchase, per the brief, rather than a fixed 28 Feb.

## Next milestones

The brief's build order from here:
- **Milestone 2:** exam engine, mocks, practice, results.
- **Milestone 3:** upload and AI pipeline.
- **Milestone 4:** shared banks and mastery.
- **Milestone 5:** flashcards, tutor and theory grading.

The Account and social screens in Milestone 6 were built early, from the designs. Home is a simple version until the exam engine provides readiness, the daily plan and "continue mock". Landing page 4a comes with the marketing work.

These hooks already exist for the exam engine to call:
- `recordWeeklyResult` (leaderboard)
- `recordUsage` (daily limits)
- challenge entries

The exam engine still needs to:
- Grant the referral reward when a referred student finishes their first mock.
- Generate the 1080×1920 "new best" story card on results.
- Cache mocks and flashcards in the service worker for offline use.
