"use client";

import { useEffect, useState } from "react";
import { formatScore } from "@/lib/exam-engine/results";

/** Score counts up from 0 on arrival (~600 ms). Skipped with reduced motion. */
export function ScoreCountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value <= 0) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3)) * 10) / 10);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={className} aria-label={formatScore(value)}>
      {formatScore(Number.isInteger(value) ? Math.round(shown) : shown)}
    </span>
  );
}
