# Sono Study — Design Brief

Oct 16, 2026 · @Sono Technologies

## Direction

Energetic and focused: a study app students actually want to open at 11pm before a 9am CBT. Dark-first, vivid accent, visible progress, and total calm the moment a mock starts.

**Principles**

- **Two modes, two moods.** Home, courses and results feel lively (streaks, rings, XP). The exam screen strips everything back to the question, the timer and the navigator.
- **Progress you can see.** Mastery rings, streak flames, readiness scores: every session visibly moves something.
- **Feels like the real CBT, but better.** The mock layout should feel familiar to Nigerian campus CBT centres, just cleaner and readable on a phone.
- **Fast on cheap phones.** Light pages, few images, system-friendly fonts, no heavy animation during study.
- **Student voice.** Friendly, a little playful, never childish. Nigerian campus references welcome in copy ("Before your GST exam…").

**References for mood (not to copy):** the focus of Notion and Linear dark modes, the motivation loops of fitness trackers, the clarity of a good exam paper.

## Brand

- **Name:** "Sono Study"; part of Sono Education (SonoCBT, Sono Schools) but with its own student-facing energy and accent.
- **Logo direction:** wordmark plus a mark built from a CBT option bubble (filled circle) merging into an upward spark or check. Works at 16px and as a one-colour app icon.
- **Voice:** encouraging, direct, lightly playful. Short lines. Celebrate effort and streaks, never shame low scores.
- **Microcopy examples:** after a weak result: "14/30. Now we know where to focus — 3 topics to fix first." Streak: "5 days straight. Your future self says thanks." Queue: "Cooking your questions… usually under a minute."

## Visual system

Dark-first with a deep indigo-navy base, an electric violet accent, and a lime highlight for wins and streaks. Light mode is a full equal, not an afterthought.

**Colour tokens**

| Token | Dark (default) | Light | Use |
| --- | --- | --- | --- |
| `--bg` | #0B0D17 | #F6F6FB | App background |
| `--surface` | #141726 | #FFFFFF | Cards, sheets |
| `--surface-2` | #1C2033 | #EEEEF6 | Inputs, option rows, navigator cells |
| `--border` | #262B42 | #E1E1EC | Hairlines |
| `--ink` | #EEF0FA | #10122B | Primary text, question stems |
| `--ink-muted` | #9499B5 | #5D6180 | Secondary text |
| `--accent` | #8B7CFF | #5B4BE6 | Primary buttons, selected option, active states |
| `--accent-soft` | #25204D | #ECE9FF | Selected backgrounds |
| `--spark` | #C6F24E | #4E8A00 | Streaks, XP, new bests |
| `--correct` | #3DD68C | #13804B | Correct answers, mastered topics |
| `--wrong` | #FF6B6B | #C7362F | Wrong answers, weak topics |
| `--flag` | #FFB547 | #A86600 | Flagged questions, timer under 5 minutes |

Mastery scale (for rings and topic chips): weak (wrong) → shaky (flag) → good (accent) → mastered (correct).

**Typography**

- Headings & numbers: **Space Grotesk** (or Satoshi): bold, techy, great for scores and timers.
- Body & question text: **Inter** at 16px minimum on mobile, 1.6 line height for question stems.
- Timer and scores: tabular figures.
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40 / 56 (results score hero).

**Spacing, shape, depth**

- 4px grid; common steps 8, 12, 16, 20, 24, 32.
- Radius: 12px buttons and option rows, 16px cards, 24px sheets, full for pills and rings.
- Depth: in dark mode use lighter surfaces and a faint accent glow for focus, not shadows.
- Icons: Phosphor or Lucide, 1.75px stroke, 20/24px.

## Key components

- **Option rows:** full-width tappable rows (min 52px) with a letter bubble (A–E) that fills with accent when selected; in review mode, green check / red cross plus the explanation panel underneath.
- **Timer pill:** sticky top-right, tabular numbers; turns `--flag` under 5 minutes and pulses once at 1 minute.
- **Question navigator:** grid of numbered cells (answered = accent fill, flagged = flag outline, unanswered = surface); opens as a bottom sheet on mobile, side panel on desktop.
- **Mastery ring:** circular progress per course/topic using the mastery scale; big version on course page, mini version on chips.
- **Topic chips:** pill with topic name and mastery colour dot; tap to practise that topic.
- **Streak + XP badge:** flame icon in `--spark` with day count, in the home header.
- **Flashcard:** large card with flip animation; four rating buttons under it (Again, Hard, Good, Easy) with the next interval shown.
- **Tutor chat bubbles:** student on accent-soft, tutor on surface; citation chips ("Week 3 slides · p.12") under tutor messages; quick-action chips above the input.
- **Theory grading card:** score ring, "Covered" list in correct colour, "Missed" list in wrong colour, one tip in a highlighted box.
- **Leaderboard rows:** rank, avatar/handle, score, time; the student's own row pinned and highlighted.
- **Share card:** 1080×1920 and 1080×1080 image templates with score, course code, streak, Sono Study logo and invite link/QR.
- **Upload progress card:** steps (Uploading → Reading → Making questions → Ready) with a live status line and queue estimate.
- **Paywall sheet:** two pass cards (Week ₦500, Semester ₦2,000, "Best value" tag), Paystack button, what you unlock.

## Screens to design

Design mobile first at 360px (cheap Android) and 390px, plus 1440px desktop. Dark and light.

**Marketing**

- Landing page: hero with a phone showing a live mock, "Upload your notes. Practise like the real CBT.", how it works in 3 steps, features, pricing (₦500 week / ₦2,000 semester), school logos placeholder, FAQ, install-the-app prompt.

**App**

| Screen | Must show |
| --- | --- |
| Onboarding | School search, department, level, add courses by code, optional exam dates |
| Home | Greeting, streak + XP, "Today's plan", cards due, upcoming exam countdowns, continue last mock, quick upload |
| Course page | Mastery ring, topic chips, shared banks, my uploads, flashcards due, leaderboard preview, tutor entry |
| Upload flow | File/camera picker (multi-photo), course select, contribute toggle, progress card, ready state |
| Mock setup | Questions, time, topics, difficulty, or pick a bank |
| Mock exam | Question, options, timer, navigator, flag, next/prev, submit confirm, offline banner |
| Results | Score hero, time, topic breakdown, "Fix weak topics", review list, share card button |
| Question review | Correct/wrong state, explanation, source page link, report |
| Practice mode | One question at a time with instant feedback |
| Flashcards | Due count, card flip, rating buttons, session summary |
| Tutor | Chat with citations, quick actions, empty state with example questions |
| Theory grading | Question, answer box, grading card |
| Leaderboard & challenge | Weekly board, challenge countdown, closed-challenge results |
| Profile & settings | School/courses, handle and anonymity, notifications, plan, data export/delete |
| Paywall | Two pass cards, Paystack checkout, success state |
| Queue / limits states | "Busy, ready in N min", daily limit reached with upgrade or invite options |

## Mobile, performance, accessibility and motion

**Mobile**

- Bottom tab bar: Home, Courses, Upload (centre, accent), Cards, Profile.
- During a mock: no tab bar, no notifications banners, only exam UI; back button asks to confirm leaving.
- Thumb-zone primary actions; tap targets at least 48px.

**Performance (cheap phones, slow data)**

- First load under 200KB of JS on the home route where possible; system font fallback while web fonts load.
- Skeleton loaders, cached course data, offline mocks and flashcards.
- Images only where they earn it; illustrations as small inline SVGs.

**Accessibility**

- WCAG AA contrast in both themes, including mastery colours (always paired with labels or icons).
- Question text scalable to 200% without breaking layout.
- Respect `prefers-reduced-motion`; visible focus states.

**Motion**

- Quick and purposeful: 150–250ms.
- Celebrations only after effort: score count-up on results, a short spark burst for new best or streak milestone, ring fill animation on course page.
- Zero decorative motion inside the exam screen except the 1-minute timer pulse.
