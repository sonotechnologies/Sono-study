/** Daily streak in Lagos days: studying today keeps it, missing a whole day resets it to 1. */
export function nextStreak(current: { streakDays: number; lastActiveDate: string | null }, today: string): { streakDays: number; lastActiveDate: string } {
  if (current.lastActiveDate === today) return { streakDays: Math.max(1, current.streakDays), lastActiveDate: today };
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const continued = current.lastActiveDate === yesterday.toISOString().slice(0, 10);
  return { streakDays: continued ? current.streakDays + 1 : 1, lastActiveDate: today };
}
