"use client";

import { useEffect, useState } from "react";
import { formatCountdown, formatHms } from "@/lib/format";

/** Live countdown to `to` (ISO). "dhm" → "1d 04h 12m", "hms" → "06:54:10". */
export function Countdown({ to, format = "dhm", className }: { to: string; format?: "dhm" | "hms"; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), format === "hms" ? 1000 : 15_000);
    return () => clearInterval(id);
  }, [format]);
  const left = target - now;
  return (
    <time dateTime={to} className={className} suppressHydrationWarning>
      {format === "hms" ? formatHms(left) : formatCountdown(left)}
    </time>
  );
}
