import { cn } from "@/lib/cn";

/** Mark 1c "Rising bubble": a filled CBT answer bubble under an upward chevron. */
export function LogoMark({ size = 26, mono, className }: { size?: number; mono?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={className}>
      <circle cx="24" cy="32" r="13" fill={mono ?? "var(--accent)"} />
      <path d="M12 14L24 4l12 10" fill="none" stroke={mono ?? "var(--spark)"} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-lg font-bold">Sono Study</span>
    </span>
  );
}
