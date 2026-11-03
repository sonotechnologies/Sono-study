"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, House, Layers, Plus, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/primitives";

const SIDEBAR = [
  { href: "/home", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/cards", label: "Cards" },
  { href: "/tutor", label: "Tutor" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Focus screens (designs 2f, 2i, 2j, 2k, 2m, 2n, 2o): full screen on phones, no tab bar.
 * Each has its own back/close control at the top.
 */
const FOCUS = [
  /^\/cards\/[^/]+(\/.*)?$/, // flashcard session, new/edit card
  /^\/tutor\/[^/]+$/,
  /^\/results\/[^/]+\/review\//,
  /^\/upload\/[^/]+$/, // upload progress / ready
  /^\/theory\/[^/]+$/,
  /^\/billing\//,
];
export const isFocusRoute = (pathname: string) => FOCUS.some((r) => r.test(pathname));

/** The page area: leaves room for the phone tab bar, except on focus screens. */
export function MainArea({ children }: { children: React.ReactNode }) {
  const focus = isFocusRoute(usePathname());
  return <div className={cn("min-w-0 flex-1 lg:pb-0", focus ? "pb-[env(safe-area-inset-bottom)]" : "pb-[calc(64px+env(safe-area-inset-bottom))]")}>{children}</div>;
}

/** Desktop (≥1024px): 248px sidebar — logo, 44px nav items, Upload CTA at the bottom. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] flex-none flex-col gap-1 border-r border-border px-4 py-6 lg:flex">
      <Link href="/home" className="px-3 pb-6">
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {SIDEBAR.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center rounded-[12px] px-3 text-[15px] transition-colors focus-visible:outline-accent",
                active ? "bg-accent-soft font-semibold text-ink" : "font-medium text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link href="/upload" className={buttonClass("primary", "md", "mt-auto")}>
        <Plus size={20} strokeWidth={1.75} aria-hidden /> Upload notes
      </Link>
    </aside>
  );
}

const TABS = [
  { href: "/home", label: "Home", Icon: House },
  { href: "/courses", label: "Courses", Icon: BookOpen },
  { href: "/upload", label: "Upload", Icon: Plus, centre: true },
  { href: "/cards", label: "Cards", Icon: Layers },
  { href: "/profile", label: "Profile", Icon: User },
];

/** Mobile: 64px bottom tab bar with the accent Upload button in the centre. */
export function TabBar() {
  const pathname = usePathname();
  if (isFocusRoute(pathname)) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map(({ href, label, Icon, centre }) => {
        const active = isActive(pathname, href);
        if (centre) {
          return (
            <Link key={href} href={href} aria-label={label} className="grid place-items-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-accent text-on-accent">
                <Icon size={22} strokeWidth={1.75} aria-hidden />
              </span>
            </Link>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", active ? "text-accent" : "text-ink-muted")}
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
