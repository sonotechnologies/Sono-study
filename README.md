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

No setup needed: without `DATABASE_URL` the app starts an embedded Postgres (PGlite) in `.next/cache/pglite`, migrates it and seeds demo data, and without auth keys you're signed in as the demo student. Without AI keys, uploads are processed by an offline stand-in provider (simple questions straight from the text), and without R2 the files go to `.next/cache/uploads`. Payments complete instantly in local dev when no Paystack key is set. `npm run db:reset-local` wipes the local database (it re-seeds on next start).

For a real setup copy `.env.example` to `.env.local`, then `npm run db:migrate && npm run db:seed`.

```bash
npm test           # unit + database tests (PGlite, no server needed)
npm run build && npm run e2e:m2   # Milestone 2 acceptance in a real browser
npm run build && npm run e2e:m3   # Milestone 3 acceptance (upload → questions, reuse, provider failover)
npm run build && npm run e2e:m4   # Milestone 4 acceptance (a classmate sees and practises shared questions)
npm run build && npm run e2e:m5   # Milestone 5 acceptance (tutor cites the right page, refuses to invent)
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

**Milestone 2 — Exam engine** ✅

The engine in `lib/exam-engine` is ported from SonoCBT's exam runtime: `lib/exams/rules.ts`, `local.ts`, `runtime.ts`, `components/exam/runtime/idb.ts` and `public/exam-sw.js`.
- **Kept from SonoCBT:**
  - server-side marking from frozen question snapshots
  - per-student seeded option order
  - a server-owned deadline, with the server auto-submitting overdue mocks itself
  - answers written to the phone (IndexedDB) first, then synced with sequence numbers, so retries and out-of-order requests are harmless
  - late answers kept aside but not marked
  - offline reopening of the mock page
  - SonoCBT's own tests, ported
- **Stripped, as the brief asks:** PINs, invigilation, device lock, IP rules, integrity events, sections and passages.
- **One deliberate change:** for **mocks**, answers made offline *before* the deadline still count if the phone reconnects up to 10 minutes after it. Answers are stamped with the server's clock as the device knows it. **Challenges** keep SonoCBT's strict 90-second grace because they rank students against each other.
- **Question types:** single choice, multiple answer (all-or-nothing or partial), true/false, and fill-in (case-insensitive, "0.5" = "1/2").
- **Screens:**

| Route | Design |
| --- | --- |
| `/courses/[id]/mock` | 2h — mock setup: count, time, topics with mastery dots and "Weak only", difficulty, or a shared bank |
| `/mock/[id]` | 1g/1i phone, 4c desktop — the exam. The timer turns amber under 5 min and pulses at 1:00. Navigator sheet or side panel, submit/leave confirmations, offline banner, A–E / ← → / F keys, back button asks first |
| `/mock/[id]` (practice) | 2i — instant feedback, "3 in a row", explanation and source |
| `/results/[id]` | 1j with 1k's "topics to fix first" cards, and 1l when you beat your best (with a 1080×1920 share card, 3h); 4d on desktop |
| `/results/[id]/review/[n]` | question review |
| `/courses` | interim course list: start a mock, "Fix weak topics" (the 3 lowest-mastery topics), leaderboard, add a question |
| `/courses/[id]/questions/new` | manual question entry (brief: for testing) |

- **What happens when a mock is submitted:**
  - the weekly leaderboard updates (20+ question mocks)
  - challenge results are recorded (once per student, same questions for everyone, capped at the challenge window)
  - XP is added
  - the streak updates, in Lagos days
  - topic mastery is recomputed from the latest 20 answers per topic, newer answers weighing more
  - the referral reward is granted: a free Week Pass for every 3 invited classmates who finish a mock
- **Home:** shows "Continue mock" while a mock is running.
- **Seed data:** 300 sample questions (60 each for GST 111, MTH 101, CHM 101, MAC 111 and PHY 101, six topics per course, all with explanations), plus one shared sample paper per course.
- **Acceptance, checked in a real browser against a production build:** `npm run build && npm run e2e:m2`. It shows:
  - a 30-question mock auto-submits at zero
  - killing the server mid-mock: answering continues, the page reloads with no connection with all answers intact, and everything syncs when the server returns
  - the per-topic breakdown adds up to the score and matches the review list
- **Tests:** the same cases are also covered at service level in `tests/exam-service.test.ts`.

**Milestone 3 — Upload and AI pipeline** ✅ (designs 2e–2g)
- **Upload (`/upload`, 2e):** Camera (several photos, numbered in order, resized on the phone to ~1600px JPEG) or Files (PDF, PPTX, DOCX, up to 20 MB). Course select. "Share with your class" toggle, on by default: generated questions join the course bank for the school, and files always stay private.
- **Storage (`lib/storage.ts`, ported from SonoCBT):** Cloudflare R2. The phone hashes the file (SHA-256), then PUTs it straight to R2 with a signed URL that expires in 10 minutes. The server never relays the bytes. Without R2 (dev only), `/api/uploads/local` takes the same signed PUT.
- **Hash reuse:** if the same file is already done (by anyone), the upload is ready instantly with no upload and no AI. The server re-hashes the stored file in the job, so a wrong phone hash can't borrow someone else's questions. In the same course with the original shared, the questions are already in the bank and nothing is copied. Otherwise they are copied in as the student's own. A second upload of a file still being processed waits for the first.
- **Pipeline (`lib/uploads.ts`, `lib/ingest/`):**
  - **Hash check, then extraction:** `pdf-parse` per page, `officeparser` per slide or per ~2,500-character Word section, AI vision for photos, 4 per call.
  - **Chunking:** ~6,000-character chunks with page labels such as "p.3–5" and "slides 4–6".
  - **Generation:** one AI call per chunk returns 6–20 questions (single, multiple, true/false, fill-in) with explanations and topics, plus flashcards.
  - **Topic merging:** topics are merged into existing course topics by similarity (SonoCBT's Sørensen–Dice, plus a word-set check).
  - **Embeddings:** chunks are embedded at 768 dimensions for the tutor.
  - **Past papers:** detected by layout (or by the vision call for photos); their real questions are transcribed as-is, answered and explained, and tagged "past question".
  - **Validation:** every reply is checked with Zod and each question on its own, so bad ones are dropped individually. Invalid output is retried once, then discarded.
- **AI adapter (`lib/ai`):** one interface: `generateQuestions`, `extractPastQuestions`, `generateFlashcards`, `readImage`, `answerFromNotes`, `gradeTheory`, `embed`.
  - **Order:** providers come from env in order: Gemini (ported from SonoCBT, with model fallback inside the provider), then Groq. A 429 or quota error cools that provider down in the `ai_providers` table for the wait the provider asked for (an hour for a daily quota), and the next one is tried. When all are cooling down, the job waits in the queue without using up a retry.
  - **Testing failover:** `AI_FORCE_FAIL=gemini` makes a provider always fail.
- **Queue (`lib/jobs.ts`, table `ai_jobs`):** workers claim jobs with `FOR UPDATE SKIP LOCKED`, Pro jobs run first, and crashed workers lose their lease after 5 minutes. Jobs retry with backoff (30 s, then 2 min), then fail with a clear message.
  - **Workers run** from Vercel Cron (`/api/cron/jobs` every minute, `vercel.json`, protected by `CRON_SECRET`), straight after an upload, and from the progress poll while someone is watching.
- **Limits (`lib/plans.ts`):**
  - Uploads per day are counted when the file arrives.
  - Pages per upload: only the first 20 (free) or 60 (Pro) are read, and the student is told.
  - AI questions per day: today's allowance is shared across chunks and counted as questions are saved.
  - Reused uploads cost no AI.
- **Progress (`/upload/[id]`, 2f):** the steps Uploading, Reading your notes, Making questions and Ready, with live counts and a status line such as "Writing questions on **Concord** (page 4 of 20)". When it's busy, the screen shows the queue wait in minutes. A student can leave: the work continues on the server and Home shows the result.
- **Ready (2g):** the question count, topics found with counts, flashcards made, +60 XP, "Start a 20-question mock" and Practise (both from this upload's questions), and an AI-generated label.
- **Review (`/upload/[id]/questions`):** every generated question with its answer, explanation and source ("GST111 notes · p.4"). Students can edit or delete their own; a deleted question is hidden, so past results keep their review.
- **+50 XP** goes to the uploader the first time a classmate practises their questions.
- **Acceptance, checked in a real browser against a production build:** `npm run build && npm run e2e:m3`. It shows:
  - a 20-page PDF becomes 30+ questions and flashcards
  - a classmate's re-upload of the same file is ready in under a second
  - with `AI_FORCE_FAIL` on the first provider, every chunk is made by the second and the first is cooling down
- **Tests:** `tests/upload-pipeline.test.ts` and `tests/ai-ingest.test.ts` cover these and the Gemini/Groq adapters with mocked HTTP, extraction of PDF, PPTX and DOCX, chunking, topic merging and validation.

**Milestone 4 — Shared banks and mastery** ✅ (designs 2d, 1e with 1d's plan, 4b)
- **Course banks (`lib/banks.ts`):**
  - Every finished upload becomes a bank. With "Share with your class" on, its questions join the course for that school only (courses are per school + code).
  - The course page lists the seeded sample paper (**Verified**), classmates' banks with question count, students who took them and rating, and the class bank (every contributed question).
  - Banks open the mock setup preselected. Practising them costs no AI, so it's unlimited on every plan.
- **Contribute toggle after the fact:** on an upload's review page. Questions, flashcards and the bank follow it; the file never leaves.
- **Ratings:** after finishing a mock from someone else's bank, the results screen asks for 1–5 stars. Banks with 3+ ratings sort by rating.
- **Reporting (`lib/reports.ts`):**
  - Report is on the review screen, in practice feedback, and on classmates' questions, with reasons wrong answer / off-topic / copied / inappropriate plus a note.
  - 3 open reports hide a question pending review.
  - `/admin/reports` lists reported questions (auto-hidden first) with reasons and notes. Restore or Remove. Admins come from `ADMIN_EMAILS`; in local demo mode anyone can open it.
- **AI labels:** explanations of questions made from notes say "AI-generated from notes".
- **Readiness and plan (`lib/study-plan.ts`):**
  - **Readiness:** mastery across the course's topics, weighted by bank size (capped at 30 per topic). Untried topics count as 0, and a course with nothing practised shows "not started". A daily snapshot gives "+6% this week".
  - **Today's plan:** sized by days to the exam, as 10, 15 or 20 questions on the weakest topic, plus a timed mock (30 questions in the last week). Items tick themselves off from today's answers.
  - **Free vs Pro:** Free gets two items. Pro gets up to four, plus a day-by-day plan to the exam.
- **Course page (`/courses/[id]`, 2d):**
  - readiness ring and trend, exam countdown
  - topic chips coloured by mastery (tap to practise), flashcards and tutor tiles, Start a mock
  - Today's plan
  - **Read next:** for weak topics, the pages of your own notes those questions came from. `/api/uploads/[id]/file` opens your file at that page, via a 10-minute signed link, owner only.
  - shared banks, my uploads, this week's board with your row highlighted
  - exam date and time
- **Home (1e + 1d, desktop 4b):** the next exam's readiness ring, "Start 30-question mock", "Fix 3 weak topics", Flashcards and Plan tiles, Today's plan, and your courses sorted weakest first.
- **Acceptance, checked in a real browser against a production build:** `npm run build && npm run e2e:m4`.
  - Ada uploads with sharing on. Bisi, at the same school and on the same course, sees Ada's bank on the course page, takes it (the mock is Ada's questions) and rates it, and Ada gets +50 XP.
  - When Ada turns sharing off, the bank disappears for Bisi.
  - `tests/shared-banks.test.ts` covers the same at service level, plus another school's GST 111 never seeing it, reporting, ratings, readiness and the plan.

**Milestone 5 — Flashcards, tutor, theory grading** ✅ (designs 2j–2o)
- **Flashcards (`lib/flashcards.ts`, `/cards`):**
  - **Scheduling:** SM-2 with the design's four buttons. New cards go Again <1 min, Hard 6 min, Good 1 day, Easy 4 days. Learned cards grow by their ease (min 1.3), and a lapse resets them to under a minute.
  - **Due queue:** reviews first, plus 20 new cards a day; cards a student wrote come first. Due counts show on Home, the course page and the cards list.
  - **Review session (2j–2l):** a 3D flip (a crossfade with reduced motion), Space to flip, 1–4 to rate. The summary shows the rating spread, XP (3 per card), next due, and "Practise the N Again cards".
  - **Your own cards:** students write their own (private) cards and edit cards from their uploads.
  - **In the plan:** "Review N flashcards" heads the day's plan on every plan; reviews keep the streak.
  - **Sample cards:** 20 per seeded course.
- **Tutor (`lib/tutor.ts`, `/tutor/[courseId]`, 2m–2n):**
  - **What it reads:** the student's own notes plus classmates' contributed notes for the course, nothing else.
  - **Retrieval:** the 8 nearest chunks by pgvector cosine distance (word overlap when there are no embeddings), split back into pages, re-ranked by overlap with the question. The top 5 passages go to the AI.
  - **Citations:** every answer cites its passages, e.g. "Week 3 slides · p.3". Chips for the student's own notes open their file at that page; classmates' show "Classmate's notes · p.N" with no link, since files stay private.
  - **Refuses to invent:** if the notes don't cover the question, or the AI cites nothing it was given, the reply is "Your GST 111 notes don't cover that, so I won't guess."
  - **No exam help:** it declines while a timed mock is running or when asked for help mid-exam.
  - **Quick actions:** Quiz me on this / Explain simpler / Give an example.
  - **Daily cap:** 10 messages (Pro 100).
- **Theory grading (`lib/theory.ts`, `/courses/[id]/theory`, `/theory/[id]`, 2o):**
  - **Where questions come from:** uploads add one theory question per chunk with a marking guide (key points and marks) and a model answer. Seeded courses have two each.
  - **Rubrics:** a theory question without a guide gets one made on first grading, stored for next time.
  - **Grading:** the result shows the score out of max, a verdict, points covered and missed, and one tip with the source, labelled "AI guidance against a marking guide, not an official grade".
  - **The rest:** Rewrite answer, Next question, a model answer, drafts kept on the phone. Daily cap: 3 (Pro 30).
- **Acceptance, checked in a real browser against a production build:** `npm run build && npm run e2e:m5`.
  - **Right page:** the tutor answers "What are the four stages of listening?" citing **Week 3 slides · p.3**, and that chip opens the PDF at page 3.
  - **No inventing:** asked something the notes don't contain, it says so with no citation.
  - **Also covered:** a 20-card flashcard session reaches its summary, and a theory answer is marked against its guide.
  - **Service-level tests:** in `tests/tutor.test.ts`, `tests/flashcards.test.ts` and `tests/theory.test.ts`. They also cover an AI reply that cites nothing being refused, classmates' notes, exam-in-progress refusals and the daily caps.

**Setting up AI and storage**
1. **Gemini (required for real questions):** get a free key at aistudio.google.com and set `GEMINI_API_KEY`. `GEMINI_MODEL` takes a comma-separated fallback list. Check the current free-tier models and limits when you set it up, because they change often. `GEMINI_EMBED_MODEL` defaults to `gemini-embedding-001`.
2. **Groq (optional fallback):** a free key from console.groq.com in `GROQ_API_KEY`. `GROQ_MODEL` is optional.
3. **Cloudflare R2:**
   - **Variables:** set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. The bucket stays private.
   - **CORS rule:** add one to the bucket so phones can PUT to it: allowed origin `APP_URL`, method `PUT`, header `Content-Type`.
4. **Cron:** set `CRON_SECRET`. On the Vercel Hobby plan, crons run at most once a day, so either use Pro or point any every-minute scheduler at `/api/cron/jobs` with `Authorization: Bearer $CRON_SECRET`. Uploads are also processed straight away after upload and while the progress screen is open.

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
| `/admin/reports` | Reported questions, for admins (`ADMIN_EMAILS`). Linked from Profile. |
| `/upload` | When today's uploads or AI questions are used up, shows the daily-limit state, with the invite link and WhatsApp share. |
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
- **Milestone 6:** social and monetisation. Most of it was built early: leaderboards, challenges, share cards, streaks, daily limits, Paystack passes and referrals. What's left is the acceptance run: a free user hits the daily question limit, buys a ₦500 Week Pass in Paystack test mode, and the limits lift immediately. That needs a Paystack test key.

The Account and social screens in Milestone 6 were built early, from the designs. Landing page 4a comes with the marketing work.

**Local testing tips** (demo mode):
- `/courses/<id>/mock?quick=1` adds a 1-minute timer for trying auto-submit.
- `/dev/new-student?ready=1&next=/upload` signs you in as a fresh classmate of the demo student, with a full upload allowance.
- `FAKE_AI_DELAY_MS=3000 npm run dev` slows the offline provider so you can watch the progress screen.
- The local database seeds sample flashcards and theory questions only on a fresh start: run `npm run db:reset-local` once after pulling this milestone.
