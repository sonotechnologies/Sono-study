/** Progress ring (design 1e/2d): track in --surface-2, round cap, starts at 12 o'clock. */
export function Ring({
  value,
  size,
  stroke,
  color = "var(--accent)",
  label,
  children,
}: {
  /** 0–1; null draws only the track. */
  value: number | null;
  size: number;
  stroke: number;
  color?: string;
  /** Accessible description, e.g. "68% ready". */
  label?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
