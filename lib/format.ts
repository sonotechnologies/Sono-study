const pad = (n: number) => String(n).padStart(2, "0");

/** 200000 → "₦2,000" */
export function formatNaira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

/** Seconds → "19:40" (or "1:02:05" past an hour). */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Milliseconds → "1d 04h 12m" (challenge countdown). */
export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m`;
}

/** Milliseconds → "06:54:10" (daily-limit reset). */
export function formatHms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** "28 Feb 2027" */
export function formatDate(d: Date, opts: { year?: boolean } = { year: true }): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(opts.year ? { year: "numeric" } : {}),
    timeZone: "Africa/Lagos",
  });
}

export function initials(name: string): string {
  const parts = name
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** 6 → "6th", 21 → "21st" */
export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** "GST111" → "GST 111" */
export function displayCourseCode(code: string): string {
  return code.replace(/^([A-Z]+)(\d+)/, "$1 $2");
}

/** "today", "yesterday", "3 days ago", "last week", "2 weeks ago", then the date. */
export function timeAgo(d: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 35) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(d, { year: false });
}
