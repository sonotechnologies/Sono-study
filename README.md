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

**Foundation (part of milestone 1)**
- Design tokens for dark and light themes (`app/globals.css`), fonts, PWA manifest and icons.
- App shell: a 248px sidebar on desktop and a bottom tab bar on phones.
- Full data model from the brief in `db/schema.ts`, with migrations in `db/migrations`.
- Auth.js wiring, plus a demo mode for local dev.
- Every plan limit and price lives in `lib/plans.ts`.

**Account screens** (designs 6a–6e desktop, 3a–3i phone)
| Route | What it does |
| --- | --- |
| `/leaderboard` | Weekly / all-time / department board per course, ranked by score then time. Your own row is pinned. Live challenge countdown with "Join · remind me". Last challenge result. |
| `/leaderboard/challenges/[id]` | Closed challenge: placing, Top %, XP and badge, class average, final standings, share. |
| `/api/share/challenge/[id]` | 1080×1080 share card (PNG) with invite link and QR. |
| `/profile` | Handle, anonymous toggle, notification toggles and reminder time, plan card, theme, data export, account deletion. |
| `?paywall=1` on any page | Paywall: bottom sheet on phones, modal on desktop. Paystack checkout. |
| `/billing/callback`, `/api/paystack/webhook`, `/billing/success` | Verify payments server-side and extend `proUntil`. Passes stack, and a payment is applied only once. |
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

The Home dashboard, onboarding, landing page, exam engine, upload pipeline, flashcards, tutor and theory grading are placeholders for now. The brief's build order covers them.

These hooks already exist for the exam engine to call:
- `recordWeeklyResult` (leaderboard)
- `recordUsage` (daily limits)
- challenge entries

The exam engine still needs to:
- Grant the referral reward when a referred student finishes their first mock.
- Generate the 1080×1920 "new best" story card on results.
