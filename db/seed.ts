import { count } from "drizzle-orm";
import type { Db } from "./index";
import * as s from "./schema";
import { addDays, lagosDate, weekStart } from "../lib/time";

export const DEMO_USER_ID = "demo-tolu";

/** Small deterministic PRNG so the demo data is the same on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["ada", "chidi", "fola", "ngozi", "seun", "kemi", "ibrahim", "tunde", "amaka", "bola", "emeka", "funmi", "gbenga", "halima", "ife", "jide", "kunle", "lola", "musa", "nneka", "obinna", "pelumi", "rukky", "sade", "temi", "uche", "victor", "wale", "yemi", "zainab"];
const SUFFIX = ["", "_", ".b", "_a", ".mc", ".writes", "_reads", "x", "99", ".dev", "_o", "2k"];
const DEPARTMENTS = ["Mass Communication", "Economics", "Law", "Computer Science", "English", "Accounting"];

/** Friday 18:00 Lagos on or after `now` (or next week's if this week's has passed). */
function nextFridayChallengeStart(now: Date): Date {
  const watNow = new Date(now.getTime() + 3600_000);
  const daysToFri = (5 - watNow.getUTCDay() + 7) % 7;
  const start = Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth(), watNow.getUTCDate() + daysToFri, 17); // 18:00 WAT
  return start > now.getTime() ? new Date(start) : addDays(new Date(start), 7);
}

export async function seedIfEmpty(db: Db, now: Date = new Date()) {
  const [{ n }] = await db.select({ n: count() }).from(s.schools);
  if (n > 0) return false;
  await seed(db, now);
  return true;
}

export async function seed(db: Db, now: Date = new Date()) {
  const rand = mulberry32(111);

  // Schools & courses
  const [unilag, yabatech, fce] = await db
    .insert(s.schools)
    .values([
      { id: "sch-unilag", name: "University of Lagos", shortName: "UNILAG", type: "university", state: "Lagos" },
      { id: "sch-yabatech", name: "Yaba College of Technology", shortName: "YABATECH", type: "poly", state: "Lagos" },
      { id: "sch-fce-akoka", name: "Federal College of Education (Technical), Akoka", shortName: "FCE Akoka", type: "coe", state: "Lagos" },
    ])
    .returning();
  void fce;

  const [gst, mth, chm, mac] = await db
    .insert(s.courses)
    .values([
      { id: "crs-gst111", schoolId: unilag.id, code: "GST111", title: "Communication in English" },
      { id: "crs-mth101", schoolId: unilag.id, code: "MTH101", title: "Elementary Mathematics I" },
      { id: "crs-chm101", schoolId: unilag.id, code: "CHM101", title: "General Chemistry I" },
      { id: "crs-mac111", schoolId: unilag.id, code: "MAC111", title: "Introduction to Mass Communication" },
      { id: "crs-gns101", schoolId: yabatech.id, code: "GNS101", title: "Use of English I" },
    ])
    .returning();

  // Demo student (matches the designs)
  await db.insert(s.users).values({
    id: DEMO_USER_ID,
    name: "Tolu Okafor",
    email: "tolu@example.com",
    schoolId: unilag.id,
    department: "Mass Communication",
    level: 100,
    streakDays: 6,
    lastActiveDate: lagosDate(now),
    xp: 1240,
    handle: "tolu",
    anonymous: false,
    referralCode: "tolu",
  });
  await db.insert(s.enrollments).values([
    { userId: DEMO_USER_ID, courseId: gst.id, examDate: addDays(now, 4).toISOString().slice(0, 10) },
    { userId: DEMO_USER_ID, courseId: mth.id, examDate: addDays(now, 9).toISOString().slice(0, 10) },
    { userId: DEMO_USER_ID, courseId: chm.id },
    { userId: DEMO_USER_ID, courseId: mac.id },
  ]);

  // Classmates. The first nine mirror the leaderboard in the designs.
  const named: { handle: string | null; name: string; anonymous: boolean }[] = [
    { handle: "ada_reads", name: "Ada Eze", anonymous: false },
    { handle: null, name: "Bisi Ade", anonymous: true },
    { handle: "chidi.b", name: "Chidi Bello", anonymous: false },
    { handle: "fola_", name: "Fola Ojo", anonymous: false },
    { handle: "ngozi.mc", name: "Ngozi Mba", anonymous: false },
    { handle: "seun", name: "Seun Ajayi", anonymous: false },
    { handle: null, name: "Femi Lawal", anonymous: true },
    { handle: "kemi.writes", name: "Kemi Adeyemi", anonymous: false },
    { handle: "ibrahim_a", name: "Ibrahim Abubakar", anonymous: false },
  ];
  const taken = new Set(named.map((p) => p.handle).filter(Boolean) as string[]);
  taken.add("tolu");
  while (named.length < 230) {
    const handle = FIRST[Math.floor(rand() * FIRST.length)] + SUFFIX[Math.floor(rand() * SUFFIX.length)];
    if (taken.has(handle)) continue;
    taken.add(handle);
    named.push({ handle, name: handle, anonymous: rand() < 0.45 });
  }
  const peers = named.map((p, i) => ({
    id: `peer-${String(i + 1).padStart(3, "0")}`,
    name: p.name,
    email: `peer${i + 1}@example.com`,
    schoolId: unilag.id,
    department: i % 3 === 0 ? "Mass Communication" : DEPARTMENTS[i % DEPARTMENTS.length],
    level: 100,
    xp: Math.floor(rand() * 3000),
    streakDays: Math.floor(rand() * 12),
    handle: p.handle,
    anonymous: p.anonymous,
    referredById: i < 1 ? DEMO_USER_ID : null,
  }));
  for (let i = 0; i < peers.length; i += 100) await db.insert(s.users).values(peers.slice(i, i + 100));
  await db.insert(s.enrollments).values(peers.map((p) => ({ userId: p.id, courseId: gst.id })));

  // This week's GST 111 board: designed top nine, then Tolu at #14.
  const week = weekStart(now);
  const fixed: [score: number, time: string, mocks: number][] = [
    [29, "12:48", 14], [28, "15:02", 9], [28, "17:30", 11], [27, "13:55", 7], [27, "16:12", 8],
    [26, "11:40", 5], [26, "18:09", 6], [25, "14:20", 10], [25, "16:55", 4],
    [25, "18:30", 3], [24, "15:10", 5], [24, "17:02", 2], [24, "18:44", 7],
  ];
  const sec = (t: string) => {
    const [m, ss] = t.split(":").map(Number);
    return m * 60 + ss;
  };
  const weekRows = fixed.map(([score, time, mocks], i) => ({
    courseId: gst.id, weekStart: week, userId: peers[i].id, score, maxScore: 30, timeSec: sec(time), mocks,
  }));
  weekRows.push({ courseId: gst.id, weekStart: week, userId: DEMO_USER_ID, score: 24, maxScore: 30, timeSec: sec("19:40"), mocks: 6 });
  for (let i = fixed.length; i < 48; i++) {
    weekRows.push({
      courseId: gst.id, weekStart: week, userId: peers[i].id,
      score: 8 + Math.floor(rand() * 16), maxScore: 30, timeSec: 600 + Math.floor(rand() * 1200), mocks: 1 + Math.floor(rand() * 6),
    });
  }
  // A few results from earlier weeks for the all-time view
  const lastWeek = weekStart(addDays(now, -7));
  weekRows.push(
    { courseId: gst.id, weekStart: lastWeek, userId: peers[20].id, score: 30, maxScore: 30, timeSec: sec("16:20"), mocks: 4 },
    { courseId: gst.id, weekStart: lastWeek, userId: DEMO_USER_ID, score: 22, maxScore: 30, timeSec: sec("21:05"), mocks: 3 },
  );
  await db.insert(s.leaderboardEntries).values(weekRows);

  // Challenges: next Friday's (open for sign-up) and last Friday's (closed).
  const WINDOW_MS = 4 * 3600_000; // open 18:00–22:00 Lagos
  const nextStart = nextFridayChallengeStart(now);
  let lastStart = addDays(nextStart, -7);
  if (lastStart.getTime() + WINDOW_MS > now.getTime()) lastStart = addDays(lastStart, -7); // must already be closed
  const [upcoming, closed] = await db
    .insert(s.challenges)
    .values([
      { id: "chl-gst111-next", courseId: gst.id, title: "Friday Challenge", questionCount: 30, durationSec: 20 * 60, startsAt: nextStart, endsAt: new Date(nextStart.getTime() + WINDOW_MS) },
      { id: "chl-gst111-last", courseId: gst.id, title: "Friday Challenge", questionCount: 30, durationSec: 20 * 60, startsAt: lastStart, endsAt: new Date(lastStart.getTime() + WINDOW_MS) },
    ])
    .returning();
  await db.insert(s.challengeSignups).values(peers.slice(0, 218).map((p) => ({ challengeId: upcoming.id, userId: p.id })));

  // Closed challenge: 212 took it; Tolu placed #6 with 26/30 in 14:02; class average ≈ 17.
  const top: [number, string][] = [[29, "12:48"], [28, "15:02"], [28, "17:30"], [27, "13:55"], [27, "16:12"]];
  const closedRows = top.map(([score, time], i) => ({ courseId: gst.id, challengeId: closed.id, userId: peers[i].id, score, maxScore: 30, timeSec: sec(time), mocks: 1 }));
  closedRows.push({ courseId: gst.id, challengeId: closed.id, userId: DEMO_USER_ID, score: 26, maxScore: 30, timeSec: sec("14:02"), mocks: 1 });
  for (let i = 5; i < 211; i++) {
    const score = Math.min(25, Math.max(4, Math.round(16.5 + (rand() + rand() + rand() - 1.5) * 9)));
    closedRows.push({ courseId: gst.id, challengeId: closed.id, userId: peers[i].id, score, maxScore: 30, timeSec: 540 + Math.floor(rand() * 660), mocks: 1 });
  }
  for (let i = 0; i < closedRows.length; i += 100) await db.insert(s.leaderboardEntries).values(closedRows.slice(i, i + 100));

  // One referred classmate has finished a mock (referral progress 1 of 3).
  await db.insert(s.mockAttempts).values({
    userId: peers[0].id, courseId: gst.id, questionIds: [], durationSec: 1800, submittedAt: now, score: 29, mode: "mock",
  });

  // Today's free uploads already used — drives the daily-limit state.
  await db.insert(s.aiUsage).values({ userId: DEMO_USER_ID, date: lagosDate(now), action: "upload", count: 2 });
}
