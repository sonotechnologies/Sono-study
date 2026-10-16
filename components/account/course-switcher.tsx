"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { displayCourseCode } from "@/lib/format";

/**
 * Course code that opens the native picker when tapped. With one course it's
 * plain text.
 */
export function CourseSwitcher({ courses, value }: { courses: { id: string; code: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = courses.find((c) => c.id === value);
  if (!current) return null;
  if (courses.length < 2) return <>{displayCourseCode(current.code)}</>;
  return (
    <span className="relative inline-flex items-center gap-1">
      {displayCourseCode(current.code)}
      <ChevronDown size={18} strokeWidth={2} className="text-ink-muted" aria-hidden />
      <select
        aria-label="Course"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("course", e.target.value);
          router.push(`${pathname}?${next}`, { scroll: false });
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {displayCourseCode(c.code)}
          </option>
        ))}
      </select>
    </span>
  );
}
