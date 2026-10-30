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
                "flex h-11 items-center rounded-[12px] px-3 text-[15px] transition-colors",
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
