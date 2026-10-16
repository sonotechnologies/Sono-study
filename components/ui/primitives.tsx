import Link from "next/link";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "outline-correct";
type ButtonSize = "lg" | "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary: "bg-surface-2 text-ink hover:bg-border",
  ghost: "text-ink-muted hover:text-ink",
  // Accent-on-accent card buttons ("Join · remind me")
  inverse: "bg-on-accent text-accent hover:opacity-90",
  "outline-correct": "border border-correct text-correct hover:bg-correct-soft",
};
const SIZE: Record<ButtonSize, string> = {
  lg: "h-[52px] px-5 text-base",
  md: "h-12 px-4 text-[15px]",
  sm: "h-11 px-3.5 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string | false) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[12px] font-semibold transition-[filter,background-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-surface", className)} {...props} />;
}

/** Small muted heading above a settings group ("Study", "Notifications"). */
export function GroupLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pb-1.5 text-[13px] text-ink-muted lg:pb-1 lg:pt-3", className)} {...props} />;
}

/** Initials avatar. Size it with classes, e.g. "size-7 text-[11px] lg:size-8 lg:text-xs". */
export function Avatar({ name, highlight = false, className }: { name: string; highlight?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 flex-none place-items-center rounded-full text-xs font-bold",
        highlight ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-muted",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Pill({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex h-10 items-center rounded-full border border-border bg-surface px-3.5 font-display font-semibold", className)}
      {...props}
    />
  );
}

/** Segmented control made of links, so each option is a URL. */
export function Segmented({
  options,
  value,
  className,
  label,
}: {
  options: { value: string; label: string; href: string }[];
  value: string;
  className?: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className={cn("grid gap-1 rounded-[12px] bg-surface-2 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, auto)` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Link
            key={o.value}
            href={o.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "grid h-10 place-items-center rounded-[9px] px-3.5 text-sm font-semibold transition-colors lg:h-9",
              active ? "bg-surface text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
