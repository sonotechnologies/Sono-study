"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, Search, X } from "lucide-react";
import { checkHandle, submitOnboarding, suggestCourses } from "@/app/onboarding/actions";
import { Logo } from "@/components/logo";
import { Switch } from "@/components/ui/switch";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DEPARTMENTS, LEVELS, levelLabel, normaliseCourseCode } from "@/lib/courses";
import { displayCourseCode } from "@/lib/format";
import type { SchoolOption } from "@/lib/onboarding";
import { NIGERIAN_STATES } from "@/lib/states";

type CourseEntry = { code: string; examDate: string | null; examTime: string | null };
type SchoolChoice = { id: string } | { newName: string; state: string } | null;

export interface OnboardingInitial {
  schoolId: string | null;
  name: string;
  handle: string;
  anonymous: boolean;
  department: string;
  level: number;
  courses: CourseEntry[];
}

const INPUT =
  "h-[52px] w-full rounded-[12px] border border-transparent bg-surface-2 px-3.5 text-base text-ink outline-none placeholder:text-ink-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]";

/** Token prefix match: "uni lag" finds University of Lagos, LASU and LASUSTECH. */
function matchSchools(schools: SchoolOption[], query: string): SchoolOption[] {
  const q = query.toLowerCase().trim();
  if (!q) return schools.slice(0, 5);
  const compact = q.replace(/[^a-z0-9]/g, "");
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  return schools
    .filter((s) => {
      if (s.shortName.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(compact)) return true;
      const words = `${s.name} ${s.shortName} ${s.town ?? ""} ${s.state}`.toLowerCase().split(/[^a-z0-9]+/);
      return tokens.every((t) => words.some((w) => w.startsWith(t)));
    })
    .slice(0, 6);
}

function formatExam(date: string, time: string | null) {
  const d = new Date(`${date}T12:00:00+01:00`);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "Africa/Lagos" });
  const day = `${part({ weekday: "short" })} ${part({ day: "numeric" })} ${part({ month: "short" })}`;
  return time ? `${day} · ${time.replace(/^0/, "")}` : day;
}

export function OnboardingFlow({
  schools,
  initial,
  initialStep,
  editing,
  anonymousName,
  today,
}: {
  /** Lagos date, YYYY-MM-DD — earliest pickable exam date. */
  today: string;
  schools: SchoolOption[];
  initial: OnboardingInitial;
  initialStep: number;
  editing: boolean;
  anonymousName: string;
}) {
  const [step, setStep] = useState(initialStep);
  const [school, setSchool] = useState<SchoolChoice>(initial.schoolId ? { id: initial.schoolId } : null);
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle);
  const [anonymous, setAnonymous] = useState(initial.anonymous);
  const [department, setDepartment] = useState(initial.department);
  const [level, setLevel] = useState(initial.level);
  const [courses, setCourses] = useState<CourseEntry[]>(initial.courses);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  const selectedSchool = school && "id" in school ? schools.find((s) => s.id === school.id) : null;
  const schoolLabel = selectedSchool?.shortName ?? (school && "newName" in school ? school.newName : "");

  function go(next: number) {
    setError(null);
    setStep(next);
    topRef.current?.scrollIntoView({ block: "start" });
  }

  function submit(skipDates: boolean) {
    setError(null);
    start(async () => {
      const result = await submitOnboarding(
        {
          school,
          name,
          handle,
          anonymous,
          department,
          level,
          courses: courses.map((c) => (skipDates ? { code: c.code, examDate: null, examTime: null } : c)),
        },
        editing ? "/profile" : "/home",
      );
      if (result && !result.ok) {
        setError(result.error);
        if (result.field === "handle") setStep(2);
        if (result.field === "courses") setStep(3);
        if (result.field === "school") setStep(1);
      }
    });
  }

  const canContinue =
    step === 1 ? school !== null : step === 2 ? name.trim().length > 0 && handle.trim().length >= 3 : step === 3 ? department.trim().length >= 2 && courses.length > 0 : true;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col lg:py-10">
      <div ref={topRef} className="hidden px-5 pb-6 lg:block">
        <Logo />
      </div>
      <div className="flex items-center gap-2 px-5 pt-4 lg:pt-0">
        {step > 1 && (
          <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="-my-3 -ml-3 grid size-12 flex-none place-items-center rounded-full hover:bg-surface-2">
            <ChevronLeft size={22} aria-hidden />
          </button>
        )}
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} className="flex flex-1 gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-200", i <= step ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        {step === 1 && <SchoolStep schools={schools} school={school} onPick={setSchool} />}
        {step === 2 && (
          <NameStep
            name={name}
            handle={handle}
            anonymous={anonymous}
            anonymousName={anonymousName}
            onName={setName}
            onHandle={setHandle}
            onAnonymous={setAnonymous}
          />
        )}
        {step === 3 && (
          <CoursesStep
            schoolLabel={schoolLabel}
            schoolType={selectedSchool?.type}
            schoolId={selectedSchool?.id ?? null}
            department={department}
            level={level}
            courses={courses}
            onDepartment={setDepartment}
            onLevel={setLevel}
            onCourses={setCourses}
          />
        )}
        {step === 4 && <ExamsStep courses={courses} today={today} onCourses={setCourses} />}
        {error && (
          <p role="alert" className="text-sm text-wrong">
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 bg-bg px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
        {step < 4 ? (
          <button
            type="button"
            disabled={!canContinue || pending}
            className={buttonClass("primary", "lg")}
            onClick={() => {
              if (step === 2) {
                start(async () => {
                  const res = await checkHandle(handle);
                  if (res.ok) go(3);
                  else setError(res.error ?? null);
                });
              } else go(step + 1);
            }}
          >
            {step === 3 ? `Continue with ${courses.length} course${courses.length === 1 ? "" : "s"}` : pending ? "Checking…" : "Continue"}
          </button>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => submit(false)} className={buttonClass("primary", "lg")}>
              {pending ? "Building your plan…" : editing ? "Save" : "Build my plan"}
            </button>
            {!editing && (
              <button type="button" disabled={pending} onClick={() => submit(true)} className={buttonClass("ghost", "sm", "text-[15px]")}>
                Skip for now
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StepHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-muted">{eyebrow}</span>
      <h1 className="font-display text-[28px] font-bold leading-[1.15]">{title}</h1>
      {sub && <p className="text-[15px] leading-normal text-ink-muted">{sub}</p>}
    </div>
  );
}

function SchoolStep({ schools, school, onPick }: { schools: SchoolOption[]; school: SchoolChoice; onPick: (s: SchoolChoice) => void }) {
  const picked = school && "id" in school ? schools.find((s) => s.id === school.id) : null;
  const [query, setQuery] = useState(picked?.shortName ?? "");
  const [adding, setAdding] = useState(school !== null && "newName" in school);
  const [newName, setNewName] = useState(school && "newName" in school ? school.newName : "");
  const [state, setState] = useState(school && "newName" in school ? school.state : "Lagos");
  const results = useMemo(() => matchSchools(schools, query), [schools, query]);
  const shown = picked && !results.some((r) => r.id === picked.id) ? [picked, ...results].slice(0, 6) : results;

  useEffect(() => {
    if (adding) onPick(newName.trim().length >= 4 ? { newName: newName.trim(), state } : null);
  }, [adding, newName, state, onPick]);

  return (
    <>
      <StepHeading eyebrow="Step 1 of 4" title="Where do you study?" />
      {!adding ? (
        <>
          <label className={cn(INPUT, "flex items-center gap-2.5 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]")}>
            <Search size={18} className="flex-none text-ink-muted" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your school"
              aria-label="Search your school"
              autoComplete="off"
              className="h-full flex-1 bg-transparent outline-none placeholder:text-ink-muted"
            />
          </label>
          {shown.length > 0 ? (
            <ul role="listbox" aria-label="Schools" className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
              {shown.map((s, i) => {
                const selected = picked?.id === s.id;
                return (
                  <li key={s.id} role="option" aria-selected={selected} className={cn(i > 0 && "border-t border-border")}>
                    <button
                      type="button"
                      onClick={() => onPick({ id: s.id })}
                      className={cn("flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left", selected ? "bg-accent-soft" : "hover:bg-surface-2")}
                    >
                      <span className="text-[15px] font-semibold">{s.name}</span>
                      <span className="text-[13px] text-ink-muted">
                        {s.shortName} · {s.town ? `${s.town}, ` : ""}
                        {s.state}
                        {s.students > 0 && ` · ${s.students.toLocaleString("en-NG")} students`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[15px] text-ink-muted">No school matches “{query}”.</p>
          )}
          <p className="text-[13px] leading-normal text-ink-muted">
            Can&apos;t find your school?{" "}
            <button
              type="button"
              className="font-semibold text-accent"
              onClick={() => {
                setNewName(query.length > 5 ? query : "");
                setAdding(true);
              }}
            >
              Add it
            </button>
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
            School name
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Federal University Lokoja" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
            State
            <span className="relative">
              <select value={state} onChange={(e) => setState(e.target.value)} className={cn(INPUT, "appearance-none pr-10")}>
                {NIGERIAN_STATES.map((st) => (
                  <option key={st}>{st}</option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
            </span>
          </label>
          <p className="text-[13px] leading-normal text-ink-muted">We&apos;ll check it and add it for your classmates. You can carry on now.</p>
          <button
            type="button"
            className="self-start text-[13px] font-semibold text-accent"
            onClick={() => {
              setAdding(false);
              onPick(null);
            }}
          >
            Back to search
          </button>
        </div>
      )}
    </>
  );
}

function NameStep({
  name,
  handle,
  anonymous,
  anonymousName,
  onName,
  onHandle,
  onAnonymous,
}: {
  name: string;
  handle: string;
  anonymous: boolean;
  anonymousName: string;
  onName: (v: string) => void;
  onHandle: (v: string) => void;
  onAnonymous: (v: boolean) => void;
}) {
  return (
    <>
      <StepHeading eyebrow="Step 2 of 4" title="What should we call you?" />
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        Your name
        <input value={name} onChange={(e) => onName(e.target.value)} autoComplete="name" maxLength={60} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        Handle
        <span className={cn(INPUT, "flex items-center gap-1 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]")}>
          <span className="text-ink-muted">@</span>
          <input
            value={handle}
            onChange={(e) => onHandle(e.target.value.replace(/^@/, ""))}
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            maxLength={20}
            className="h-full flex-1 bg-transparent text-ink outline-none"
          />
        </span>
      </label>
      <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <label htmlFor="anon" className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px]">Appear as anonymous on leaderboards</span>
          <span className="text-[13px] text-ink-muted">
            {anonymous ? `Classmates see "${anonymousName}"` : `Classmates see @${handle || "you"}`}. Change it any time.
          </span>
        </label>
        <Switch id="anon" checked={anonymous} onCheckedChange={onAnonymous} />
      </div>
    </>
  );
}

function CoursesStep({
  schoolLabel,
  schoolType,
  schoolId,
  department,
  level,
  courses,
  onDepartment,
  onLevel,
  onCourses,
}: {
  schoolLabel: string;
  schoolType?: string;
  schoolId: string | null;
  department: string;
  level: number;
  courses: CourseEntry[];
  onDepartment: (v: string) => void;
  onLevel: (v: number) => void;
  onCourses: (v: CourseEntry[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [popular, setPopular] = useState<string[]>([]);
  const codes = courses.map((c) => c.code);
  const codesKey = codes.join(",");

  useEffect(() => {
    if (!schoolId) return;
    let live = true;
    const t = setTimeout(() => {
      suggestCourses({ schoolId, level, department, exclude: codesKey ? codesKey.split(",") : [] })
        .then((r) => live && setPopular(r))
        .catch(() => {});
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [schoolId, level, department, codesKey]);

  function add(raw: string) {
    const code = normaliseCourseCode(raw);
    if (!code) {
      setCodeError("That doesn't look like a course code. Try e.g. PHY 101.");
      return;
    }
    setCodeError(null);
    setDraft("");
    if (!codes.includes(code)) onCourses([...courses, { code, examDate: null, examTime: null }]);
  }

  const shortDept = department.replace("Communication", "Comm");
  // Suggestions refresh after a short delay; never offer a course that's already picked.
  const suggestions = popular.filter((code) => !codes.includes(code));

  return (
    <>
      <StepHeading eyebrow={`Step 3 of 4${schoolLabel ? ` · ${schoolLabel}` : ""}`} title="What are you taking this semester?" />
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        Department
        <span className="relative">
          <input
            value={department}
            onChange={(e) => onDepartment(e.target.value)}
            list="departments"
            placeholder="e.g. Mass Communication"
            className={cn(INPUT, "pr-10")}
          />
          <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
          <datalist id="departments">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </span>
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[13px] text-ink-muted">Level</legend>
        <div className="grid grid-cols-5 gap-1 rounded-[12px] bg-surface-2 p-1">
          {LEVELS.map((l) => (
            <label
              key={l}
              className={cn(
                "grid h-10 cursor-pointer place-items-center rounded-[9px] font-display text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                level === l ? "bg-accent font-bold text-on-accent" : "font-semibold text-ink-muted",
              )}
            >
              <input type="radio" name="level" value={l} checked={level === l} onChange={() => onLevel(l)} className="sr-only" />
              {schoolType === "poly" ? levelLabel(l, "poly") : l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-ink-muted">Courses · add by code</span>
        {courses.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {courses.map((c) => (
              <li key={c.code} className="flex h-9 items-center gap-1.5 rounded-full bg-accent-soft pl-3 pr-1 text-sm font-semibold">
                {displayCourseCode(c.code)}
                <button
                  type="button"
                  aria-label={`Remove ${displayCourseCode(c.code)}`}
                  onClick={() => onCourses(courses.filter((x) => x.code !== c.code))}
                  className="grid size-7 place-items-center rounded-full text-ink-muted hover:text-ink"
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setCodeError(null);
            }}
            placeholder="Type a code, e.g. PHY 101"
            aria-label="Course code"
            autoCapitalize="characters"
            autoComplete="off"
            enterKeyHint="done"
            className={cn(INPUT, "h-12")}
          />
          <button type="submit" disabled={!draft.trim()} className={buttonClass("secondary", "md", "flex-none")}>
            Add
          </button>
        </form>
        {codeError && <span className="text-[13px] text-wrong">{codeError}</span>}
        {suggestions.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            Popular in {levelLabel(level, schoolType)}
            {department ? ` ${shortDept}` : ""}:
            {suggestions.map((code) => (
              <button key={code} type="button" onClick={() => add(code)} className="min-h-8 font-semibold text-accent">
                + {displayCourseCode(code)}
              </button>
            ))}
          </p>
        )}
      </div>
    </>
  );
}

function ExamsStep({ courses, today, onCourses }: { courses: CourseEntry[]; today: string; onCourses: (v: CourseEntry[]) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const update = (code: string, patch: Partial<CourseEntry>) => onCourses(courses.map((c) => (c.code === code ? { ...c, ...patch } : c)));

  return (
    <>
      <StepHeading
        eyebrow="Step 4 of 4 · optional"
        title="When are your exams?"
        sub="We'll build your daily plan around them. Add the ones you know; skip the rest."
      />
      <ul className="flex flex-col gap-2">
        {courses.map((c) => {
          const isOpen = open === c.code;
          return (
            <li key={c.code} className={cn("rounded-[12px] bg-surface", c.examDate ? "border border-border" : "border border-dashed border-border")}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : c.code)}
                className="flex min-h-14 w-full items-center gap-3 px-3.5 text-left"
              >
                <span className="flex-1 text-[15px] font-semibold">{displayCourseCode(c.code)}</span>
                {c.examDate ? (
                  <span className="text-sm">{formatExam(c.examDate, c.examTime)}</span>
                ) : (
                  <span className="text-sm font-semibold text-accent">Add date</span>
                )}
              </button>
              {isOpen && (
                <div className="flex flex-wrap items-end gap-2 px-3.5 pb-3.5">
                  <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[13px] text-ink-muted">
                    Date
                    <input
                      type="date"
                      min={today}
                      value={c.examDate ?? ""}
                      onChange={(e) => update(c.code, { examDate: e.target.value || null })}
                      className={cn(INPUT, "h-12")}
                    />
                  </label>
                  <label className="flex w-[120px] flex-col gap-1 text-[13px] text-ink-muted">
                    Time
                    <input
                      type="time"
                      value={c.examTime ?? ""}
                      onChange={(e) => update(c.code, { examTime: e.target.value || null })}
                      className={cn(INPUT, "h-12")}
                    />
                  </label>
                  {c.examDate && (
                    <button type="button" onClick={() => update(c.code, { examDate: null, examTime: null })} className="h-12 px-2 text-sm font-semibold text-ink-muted">
                      Clear
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
