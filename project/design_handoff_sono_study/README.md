# Handoff: Sono Study — full brief coverage

## Overview
Sono Study is a mobile-first study app for Nigerian university students: upload notes, practise CBT-style mocks, track mastery. This bundle covers every screen in the brief: logo, core screens with 2–3 variations (Home, Mock exam, Results), a working tap-through flow, all remaining app screens (one direction each), share cards, the landing page, and desktop 1440 layouts.

**Variations are intentionally left open.** The product owner has asked Claude Code to choose which variation to implement per screen (or combine them). Recommended defaults, with reasoning, are under "Choosing variations" below.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy. Recreate them in the target codebase's environment using its established patterns. If no codebase exists yet, choose an appropriate stack (the brief's constraints — cheap Android phones, <200KB JS on home, offline mocks/flashcards — favour a lightweight PWA, e.g. Preact/React + Vite with a service worker, or a similarly lean framework).

`Sono Study - Design Brief.md` is the original brief and the source of truth for anything not covered here (other screens, motion, accessibility, performance).

## Fidelity
**High-fidelity.** Final colours, type, spacing, radii and copy. Recreate pixel-accurately. Mobile frames are authored at 360px; every mobile canvas has a `frameWidth` tweak (360/390) showing the same layouts at 390 — layouts are fluid (full-width rows, flex/grid), nothing is fixed to 360. Desktop 1440 is shown for Landing, Home, Mock and Results; remaining desktop screens use the same shell (248px sidebar + content, single-column screens centred at max 720px).

## Choosing variations
Pick per screen; the prototype currently uses 1e / 1g / 1j.

- **Logo** — 1a Bubble check, 1b Bubble spark, 1c Rising bubble. Recommend **1c** (symmetric, survives 16px and one-colour icon best) or **1a** (strongest "correct + rising" read).
- **Home** — 1d Plan-first, 1e Readiness ring, 1f Countdown + streak week. Recommend **1e** as the base, borrowing 1d's "Today's plan" checklist and 1f's streak week strip as sections below the fold.
- **Mock exam** — 1g Classic CBT (navigator in bottom sheet), 1h Always-visible navigator strip. 1i is a *state* (under 5 min + sheet open), not an alternative. Recommend **1g** (closest to campus CBT centres, which the brief prioritises) with 1i's sheet; 1h's offline banner applies to whichever is chosen.
- **Results** — 1j Score hero + breakdown, 1k Fix-first. 1l "New best" is a *conditional state* shown only when score beats the previous attempt. Recommend **1j** as default, with 1k's "topics to fix" cards replacing the plain CTA, and 1l when a new best occurs.

## Screens / Views
All screens: 360×780 frame, `--bg` background, 28px status bar (12px, `--ink-muted`), Inter body, Space Grotesk headings/numbers, tabular figures everywhere.

### Bottom tab bar (Home only; hidden during mock)
64px tall, `--surface`, 1px top border `--border`. 5 equal columns: Home, Courses, [Upload], Cards, Profile. Labels 11px; icons 22px Lucide-style, 1.75 stroke. Active = `--accent`, inactive = `--ink-muted`. Centre Upload: 48×48, radius 16, `--accent` fill, plus icon in `--on-accent`.

### Home — 1e Readiness ring (prototype default)
- Header (padding 12px 20px 0): "Hey Tolu" Space Grotesk 18/700. Right: streak pill (padding 6×10, radius full, `--surface`, 1px `--border`) = flame icon 16px stroke `--spark` + day count 14/700 `--spark` + "· 1,240 XP" 13px `--ink-muted`. Theme toggle 36px circle next to it (prototype only).
- Content: padding 12–16px 20px, column gap 12–16.
- Readiness card: `--surface`, 1px `--border`, radius 16, padding 16–20, centred column gap 10–14. "Next exam · Mon 9:00" 13px muted; "GST 111" SG 22/700. Ring 128–152px, stroke 12, track `--surface-2`, progress `--accent`, round cap, starts at 12 o'clock. Centre "68%" SG 34–40/700 + "ready · good" 13px muted. "+6% this week" 13/600 `--spark`. Primary button full width 52px radius 12 `--accent` / `--on-accent`, 16/600 "Start 30-question mock". Secondary 48px `--surface-2` "Fix 3 weak topics".
- Two stat tiles (flex, gap 8): radius 12, padding 12, "Cards due 24", "Plan 2/4".
- "Your courses" list, sorted weakest first: rows min 44px, 28px mini-ring (r 11, stroke 4) coloured by mastery scale, course code 15px, right label 13px in mastery colour e.g. "22% · weak".

### Home — 1d Plan-first
Greeting "Good evening, Tolu" SG 22/700 + "GST 111 exam in 4 days" 14 muted; streak pill + separate XP pill. "Today's plan" card: title SG 18/700, "2 of 4 done", 6px progress bar in `--spark`, 4 rows (min 44px): done = 22px `--correct` circle with check, struck-through muted text; pending = 22px ring (2px `--accent` for next, `--border` for later), next item has "Start" link 13/600 accent. "Continue mock" card on `--accent-soft` with Resume button (48px). 2-col grid: Cards due (SG 28/700 "24", "about 6 min") and Exams list (code + days; ≤4 days in `--flag`).

### Home — 1f Countdown + streak week
"Before your GST exam…" 14 muted; headline "4 days. Let's make them count." SG 28/700, lh 1.15. Streak card: 7-col week, 32px dots — done `--spark` fill, today 2px dashed `--spark`, future `--surface-2`; copy "**5 days straight.** Your future self says thanks. One session keeps it going tonight." Exam countdown tiles (3 across; nearest on `--accent-soft` with days in `--accent`, SG 28/700). Action grid: full-width 64px accent "Continue MTH 101 mock / Q18 of 40 · 21:04 left"; 2 tiles "Cards due 24", "Ask the tutor".

### Mock exam — 1g Classic CBT (prototype default)
No tab bar, no banners other than offline.
- Top bar 56px, bottom border: 48px close (X) button → leave confirm; title "GST 111 · Mock" 15/600 + "30 questions" 12 muted; timer pill right: 36px tall, radius full, `--surface-2`, clock 16px + time SG 16/700 (mm:ss).
- 3px progress bar under it (`--accent` on `--surface-2`), width = current/total.
- Body padding 24px 20px, gap 20: "Question 7 of 30" SG 14/700 muted + topic chip (12px, 1px border, radius full). Stem Inter 17px, line-height 1.6.
- Option rows: gap 8, min-height 52, radius 12, padding 10×14, gap 12. Default `--surface-2` bg; letter bubble 28px circle, 1.5px `--ink-muted` border, 13/700 muted. Selected: bg `--accent-soft`, 1px `--accent` border, bubble filled `--accent` with `--on-accent` letter. Option text 16px.
- Action bar (padding 12 16 16, top border): Flag 48×48 (`--surface-2`; flagged = 1.5px `--flag` border, flag icon filled `--flag`), Navigator button 48px "▦ 7/30" (answered/total, SG 14/700), Prev 48×48 (40% opacity on Q1), Next 48px accent (becomes "Submit" on last question).

### Mock exam — 1h Navigator strip (alternative)
Offline banner: full-width `--surface-2`, 13px: "You're offline. Answers are saved on your phone and sync when you're back." Horizontal scrolling strip of 36px cells (radius 10) under the header. Bottom bar grid 1fr 1fr 2fr: Prev / Flag (text `--flag`) / Next, all 52px.

### Mock states — 1i
- **Timer < 5:00**: pill loses fill, gets 1.5px `--flag` border, text/icon `--flag`.
- **Timer at 1:00**: one pulse (scale 1 → 1.12 → 1, ~200ms ease-out). No other motion in exam.
- **Navigator sheet**: scrim `--scrim` below top bar; sheet `--surface`, radius 24 24 0 0, padding 12 20 20; 40×4 grabber; "All questions" SG 18/700 + time left; legend (12px swatches) Answered n / Flagged n / Blank n; grid 5–6 columns, cells 44–48px radius 10, 14–15/600. Answered = `--accent` fill / `--on-accent`; flagged = 2px `--flag` border on `--surface-2`; unanswered = `--surface-2` muted; current = 2px `--ink` border. Tapping a cell jumps and closes. Primary "Submit 25 of 30".
- **Confirm sheet** (submit/leave): title SG 22/700, body 15px lh 1.6 muted, 2 buttons 52px (cancel `--surface-2`, confirm accent).
  - Submit: "Submit mock?" / "{n} questions are still blank and {f} flagged. You can't change answers after submitting." / "Keep going" · "Submit"
  - Leave: "Leave this mock?" / "Your timer keeps running and this attempt won't count. You can resume from Home." / "Stay" · "Leave"

### Results — 1j Score hero (prototype default)
"‹ Home" back + "GST 111 · Mock results". Score "14" SG 56/700 + "/30" SG 28/600 muted; counts up from 0 on enter (~600ms total, skip if reduced motion). Result line 16px (see copy rules). 3 stat tiles (radius 12, `--surface`): Time, Score %, Earned "+40 XP" in `--spark`. "By topic": rows with name 14px + "5/6 · mastered" in mastery colour, 6px bar in same colour, sorted weakest first. Review list (prototype): 48px rows with 24px ✓/✕/– badge, truncated stem, chevron. Bottom: Retake (1fr) + primary (2fr) "Review {n} missed" / "Fix weak topics".

### Results — 1k Fix-first
104px ring coloured by mastery of overall score + "GST 111 mock", "22:18 · +40 XP", "Last try: 11/30". "3 topics to fix first": cards (radius 16) with 10px mastery dot, topic 15/600, "1/6 · weak" 13px in colour, "Practise 10" accent link. Review heatmap: 10-col grid of 24px cells, `--correct` / `--wrong`. Buttons: Share (1fr) + "Start fix session" (2fr).

### Results — 1l New best (conditional)
"NEW BEST" pill (1.5px `--spark` border, SG 13/700, letter-spacing .04em). Score 56px with 3 small rotated squares (spark burst; animate once, 150–250ms). "+6 on your last try. That's the work paying off." Stat tiles: Streak (spark), Earned (spark), Time. Share card preview 150×266 (represents 1080×1920) on `--accent`: logo, course, big score SG 40/700, streak, invite URL + QR placeholder. Buttons: "Share to Status" (2fr) + Review (1fr).

### Question review (prototype)
Top bar: back, "Review · Q3 of 10", verdict right (Correct `--correct` / Wrong or Skipped `--wrong`). Topic chip, stem, options: correct = `--correct` border + soft green bg + filled green bubble + tag "Correct"/"Your answer ✓"; wrong pick = `--wrong` equivalents + "Your answer ✗". Explanation card ("Why" SG 16/700, 15px lh 1.6) with source link in accent ("Week 2 slides · p.8") and "Report". Bottom: Previous / Next ("Back to results" on last).

### Logo (1a–1c)
Built from a filled CBT answer bubble (`--accent`) + a `--spark` element: 1a check stroke breaking out of the circle up-right; 1b four-point spark at top-right; 1c upward chevron above a smaller circle. Each shown at 120px, 32px with wordmark (Space Grotesk 26/700), 64px app icon (radius 16, accent bg, mark in `--on-accent`), and 16px. SVG paths are in the explorations file (`viewBox 0 0 48 48`). Have a designer vector-finalise the chosen mark.


## Additional screens (one direction each)
All follow the same tokens, frame (status bar 28px, top bar 56px with 48px back/close button, content padding 20px, bottom action area padding 12 20 20 with 52px primary buttons) and component rules as above. Exact values are inline in the files; ids below match the canvas badges.

**Learn screens** (`Sono Study Screens - Learn.dc.html`)
- **2a–2c Onboarding** (4 steps, 4px segmented progress bar): school search with focus ring (3px `--accent-soft` glow) and result list; department dropdown, level segmented control (100–500), course chips with ×, code input, "Popular in 100L" suggestions; optional exam dates list (set rows solid, unset rows dashed with "Add date"), "Build my plan" + "Skip for now".
- **2d Course page** (scrolls): 120px mastery ring + course title; topic chips (dot + name + mastery label); Flashcards due tile + Tutor entry tile (accent-soft); "Start a mock"; Shared banks (Verified tag in `--correct`); My uploads (file-type badge); leaderboard preview with own row highlighted.
- **2e Upload picker**: Camera (selected) / Files tiles, multi-photo thumbnail grid with order numbers (striped placeholders), course select, contribute toggle with explanation (questions shared, photos private, +50 XP).
- **2f Upload progress card**: steps Uploading → Reading → Making questions → Ready (done = filled `--correct` check, active = spinner ring in accent with live count, pending = outline); progress bar; live status line; queue copy "Cooking your questions… Usually under a minute."; "You can leave this screen".
- **2g Ready**: success check, "64 questions" SG 40, topics found chips, flashcards made + XP, primary "Start a 20-question mock", secondary Practise / Flashcards.
- **2h Mock setup**: segmented Build my own / Pick a bank; question count and time as 4-up tiles (selected = accent-soft + accent border); real-CBT hint text; topic multi-select chips with mastery dots ("Weak only" shortcut); difficulty segmented; summary line + Start.
- **2i Practice mode**: one question, instant feedback: wrong pick red-soft with ✕, correct green-soft with ✓, others dimmed 60%; feedback card ("Not quite"/"Correct", explanation, source link); in-session streak "3 in a row" in `--spark`; Ask tutor + Next question.
- **2j–2l Flashcards**: progress bar in `--spark`; card radius 24, front shows topic chip + prompt SG 28 + "Tap card to flip" (flip = 3D rotateY 200ms; reduced-motion = crossfade); back shows prompt muted, answer 18px, source; rating row of 4 × 64px: Again (wrong) <1 min, Hard (flag) 6 min, Good (accent fill) 1 day, Easy (correct) 4 days. Summary: stacked distribution bar, counts, XP, next due, "Practise the 2 Again cards".
- **2m–2n Tutor**: empty state with 3 example prompts as tappable rows; chat: student bubble `--accent-soft` radius 16 16 4 16 right-aligned, tutor bubble `--surface` + border radius 16 16 16 4; citation chips (28px pills, accent text) under tutor messages; quick-action chips above input; 48px input + 48px accent send.
- **2o Theory grading** (scrolls): question with marks, student answer block, grading card: 72px score ring + verdict, Covered list (✓ `--correct`), Missed list (✕ `--wrong`), one Tip box on `--accent-soft` with source; Rewrite answer / Next question.

**Account screens** (`Sono Study Screens - Account.dc.html`)
- **3a Leaderboard**: segmented This week / Challenges; challenge card on `--accent` with countdown (SG 28) and "Join · remind me"; table rows 48px (rank SG, avatar initials 28px, handle, best score, time), #1 rank in `--spark`; own row pinned at bottom, accent-soft + accent border.
- **3b Closed challenge**: "#6 of 212" SG 56, Top %, XP + badge, 3 stat tiles incl. class average, final standings with own row highlighted inline, Review / Share my rank.
- **3c Profile & settings** (scrolls): avatar, name, handle/XP/streak; Study (school, courses, exam dates); Leaderboards (handle, anonymous toggle with "Anonymous owl" explanation); Notifications toggles (48×28 switch); Plan card with Upgrade; Your data (Export, Theme, Delete account in `--wrong`).
- **3d Paywall sheet**: over scrimmed Home; headline, "One payment. No subscription, no auto-renew."; 4 unlocks; two pass cards — Week ₦500 / 7 days, Semester ₦2,000 (selected: 2px accent border, accent-soft, "Best value" tag on `--spark` with #0B0D17 text) "Until 28 Feb · ₦100/wk"; "Pay ₦2,000 with Paystack"; payment methods note.
- **3e Payment success**: spark check with burst, "You're on Semester Pass.", expiry, receipt details (amount, reference mono, emailed), Back to studying.
- **3f Queue busy**: "Busy right now. Ready in about 4 min.", place in line + progress (flag colour), notify copy, "Do 12 flashcards while you wait", "Skip the queue · Week Pass ₦500".
- **3g Daily limit**: "That's today's 3 free uploads.", reset countdown, invite card (+5 uploads for 2 friends, progress 1 of 2, copy link, Share on WhatsApp), "Go unlimited · from ₦500", Practise instead.
- **3h–3i Share cards**: 1080×1920 story (dark, logo, NEW BEST pill, score at 340px SG, streak/time pills, invite URL + QR) and 1080×1080 square (accent background, challenge rank). Always dark/accent regardless of app theme. Render server-side or via canvas to PNG.

**Desktop + Landing** (`Sono Study Desktop.dc.html`)
- **4a Landing** (1440, 80px side padding): nav (logo, links, Log in, Start free); hero 2-col — badge, H1 "Upload your notes. Practise like the real CBT." SG 72/1.02, subcopy 20px, CTAs, free-tier note; right: phone showing a live mock (in code, embed the real mock component in demo mode). School logo placeholders row. How it works (3 numbered cards). Features (6, 2-col list). Pricing (Free / Week ₦500 / Semester ₦2,000 Best value). FAQ accordion (first open). Install-the-app banner on `--accent`. Footer.
- **4b Desktop Home**: 248px sidebar (logo, nav items 44px, active accent-soft, Upload CTA at bottom); main: greeting SG 40 + streak/XP pills; readiness card (180px ring) + Today's plan; row of 4 tiles (continue mock, cards due, upcoming exams with mastery).
- **4c Desktop Mock**: no sidebar; 64px top bar (Leave, title, timer); question column centred max 720 (stem 20px, options 56px); right navigator panel 360px on `--surface` (legend, 5-col grid 48px cells, Submit outline button); keyboard hint "A–E to answer · ← → to move · F to flag".
- **4d Desktop Results**: sidebar + 2 columns: score hero (SG 96) + stats + actions; topic breakdown card with 15-col answer map.

## Interactions & Behavior
- Home "Start mock" → Mock (timer starts, Q1). Mock X → leave confirm → Home.
- Option tap selects (single choice, re-tap another to change). Flag toggles. Prev/Next step; Next on last → submit confirm. Navigator button opens sheet; cell tap jumps.
- Timer counts down every second; at 0 auto-submits.
- Submit → Results (score count-up). Review row → Question review at that index. Primary → first wrong question.
- Home shows "Last mock" card and updated readiness after a mock.
- Motion: 150–250ms, ease-out. Respect `prefers-reduced-motion` (no count-up, no burst, no pulse). Zero decorative motion in exam.
- Back button during mock must trigger leave confirm. Persist mock answers locally (offline).

## State Management
- Mock session: `questions[]`, `currentIndex`, `answers{index: optionIndex}`, `flags{index: bool}`, `secondsLeft`, `secondsUsed`, `sheet: null|'nav'|'submit'|'leave'`. Persist to local storage/IndexedDB for offline + resume.
- Result: `score`, `prevBest`, `answers`, `timeUsed`, `xpEarned`, per-topic `{correct,total}`.
- Mastery label from ratio: <0.34 weak, <0.6 shaky, <1 good, 1 mastered (tune with real data).
- User: `streakDays`, `xp`, `theme` (dark default, light equal).
- Prototype XP formula (placeholder): 20 + 4 × correct.

## Copy rules
Encouraging, short, never shames. Result line logic used in prototype:
- Full marks → "Full marks. Your future self says thanks."
- New best → "New best, up {d} on your last try. That's the work paying off."
- Has weak topics → "Now we know where to focus — {n} topics to fix first."
- Otherwise → "Solid run. Review the misses and go again."

## Design Tokens
| Token | Dark | Light |
|---|---|---|
| --bg | #0B0D17 | #F6F6FB |
| --surface | #141726 | #FFFFFF |
| --surface-2 | #1C2033 | #EEEEF6 |
| --border | #262B42 | #E1E1EC |
| --ink | #EEF0FA | #10122B |
| --ink-muted | #9499B5 | #5D6180 |
| --accent | #8B7CFF | #5B4BE6 |
| --accent-soft | #25204D | #ECE9FF |
| --on-accent | #0B0D17 | #FFFFFF |
| --spark | #C6F24E | #4E8A00 |
| --correct | #3DD68C | #13804B |
| --wrong | #FF6B6B | #C7362F |
| --flag | #FFB547 | #A86600 |
| --correct-soft | rgba(61,214,140,.12) | #E3F4EA |
| --wrong-soft | rgba(255,107,107,.12) | #FBE7E6 |
| --scrim | rgba(5,6,12,.72) | rgba(16,18,43,.45) |

`--on-accent` is added beyond the brief: white on #8B7CFF fails AA, so dark mode uses dark ink on accent.

- Type: Space Grotesk 500/600/700 (headings, numbers, timer); Inter 400/500/600 (body, 16px min, question stems 17px / 1.6). Scale 12/14/16/18/22/28/40/56. `font-variant-numeric: tabular-nums` globally.
- Spacing: 4px grid; 8, 12, 16, 20, 24, 32.
- Radius: 10 navigator cells, 12 buttons/option rows/tiles, 16 cards, 24 sheets, full for pills/rings.
- Depth: no shadows; lighter surfaces + hairline borders. Focus: 2px `--accent` outline, 2px offset.
- Tap targets ≥48px (option rows 52px).

## Assets
No raster images. Icons are Lucide (ISC) paths inlined: house, book-open, plus, layers, user, flame, clock, flag, layout-grid, chevron-left/right, x, check. Use the Lucide package in code. Fonts from Google Fonts. Logo marks are simple SVG drafts, to be finalised.

## Files
- `Sono Study Explorations.dc.html` — canvas with all variations (ids 1a–1l). Props: `theme`, `frameWidth`.
- `Sono Study Prototype.dc.html` — working flow: Home → Mock → Submit → Results → Review, with 10 sample GST 111 questions, explanations and sources in the logic class (`QS` array). Props: `theme`, `timerMinutes`.
- `Sono Study Screens - Learn.dc.html` — onboarding, course, upload, mock setup, practice, flashcards, tutor, theory (2a–2o). Props: `theme`, `frameWidth`.
- `Sono Study Screens - Account.dc.html` — leaderboard, challenge, profile, paywall, queue/limit, share cards (3a–3i). Props: `theme`, `frameWidth`.
- `Sono Study Desktop.dc.html` — landing page and desktop Home/Mock/Results (4a–4d). Prop: `theme`.
- `support.js` — runtime needed to open the `.dc.html` files in a browser (reference only; not part of the app).
- `Sono Study - Design Brief.md` — full brief: remaining screens, components, performance, accessibility.
