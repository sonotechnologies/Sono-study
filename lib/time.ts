/**
 * Calendar maths in Lagos time. West Africa Time is UTC+1 all year (no DST),
 * so a fixed offset is exact.
 */
const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toWat(d: Date): Date {
  return new Date(d.getTime() + WAT_OFFSET_MS);
}

/** YYYY-MM-DD of the Lagos calendar day containing `now`. */
export function lagosDate(now: Date = new Date()): string {
  return toWat(now).toISOString().slice(0, 10);
}

/** Next Lagos midnight — when daily limits reset. */
export function nextDailyReset(now: Date = new Date()): Date {
  const wat = toWat(now);
  const midnightWat = Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate() + 1);
  return new Date(midnightWat - WAT_OFFSET_MS);
}

/** Leaderboard weeks run Monday 00:00 → Sunday 23:59 Lagos time ("resets Sunday"). */
export function weekStart(now: Date = new Date()): string {
  const wat = toWat(now);
  const dow = (wat.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(wat.getTime() - dow * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}
