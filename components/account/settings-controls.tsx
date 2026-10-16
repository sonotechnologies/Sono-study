"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Moon, Sun } from "lucide-react";
import {
  deleteAccount,
  setTheme,
  updateHandle,
  updateReminderTime,
  updateToggle,
  type DeleteState,
  type HandleState,
  type ToggleSetting,
} from "@/app/(app)/profile/actions";
import { Switch } from "@/components/ui/switch";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const ROW = "flex min-h-[52px] items-center justify-between gap-3 text-[15px]";

/** A settings row with an optimistic switch that saves immediately. */
export function ToggleRow({
  setting,
  initial,
  label,
  hint,
  children,
  className,
}: {
  setting: ToggleSetting;
  initial: boolean;
  label: string;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [value, setOptimistic] = useOptimistic(initial);
  const [, start] = useTransition();
  const [error, setError] = useState(false);
  const id = `toggle-${setting}`;
  return (
    <div className={cn(ROW, hint && "min-h-16", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={id}>
          {label}
          {children}
        </label>
        {hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
        {error && <span className="text-[13px] text-wrong">Couldn&apos;t save. Try again.</span>}
      </div>
      <Switch
        id={id}
        checked={value}
        onCheckedChange={(next) =>
          start(async () => {
            setError(false);
            setOptimistic(next);
            try {
              await updateToggle(setting, next);
            } catch {
              setError(true);
            }
          })
        }
      />
    </div>
  );
}

/** "· 20:00" inside the reminder label; tapping it opens the native time picker. */
export function ReminderTime({ initial }: { initial: string }) {
  const [time, setTime] = useState(initial);
  const [, start] = useTransition();
  return (
    <>
      {" · "}
      <span className="relative inline-block rounded underline decoration-border underline-offset-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
        {time}
        {/* Invisible native input over the 24-hour label, so the label never depends on the device's clock format. */}
        <input
          type="time"
          aria-label="Reminder time"
          value={time}
          onClick={(e) => {
            e.preventDefault();
            e.currentTarget.showPicker?.();
          }}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            setTime(next);
            start(() => updateReminderTime(next));
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </span>
    </>
  );
}

export function HandleEditor({ handle }: { handle: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<HandleState, FormData>(async (prev, form) => {
    const res = await updateHandle(prev, form);
    if (res.saved) setOpen(false);
    return res;
  }, { error: null });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="text-ink-muted hover:text-ink">
        {handle ? `@${handle}` : "Pick a handle"}
        <span className="hidden lg:inline"> · Edit</span>
      </Dialog.Trigger>
      <Sheet title="Your handle" description="Shown on leaderboards when you're not anonymous.">
        <form action={action} className="flex flex-col gap-4">
          <label className="flex h-[52px] items-center gap-1 rounded-[12px] bg-surface-2 px-4 text-base focus-within:outline-2 focus-within:outline-accent">
            <span className="text-ink-muted">@</span>
            <input
              name="handle"
              defaultValue={handle ?? ""}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={21}
              className="h-full flex-1 bg-transparent outline-none"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-sm text-wrong">
              {state.error}
            </p>
          )}
          <SheetButtons pending={pending} confirm="Save" />
        </form>
      </Sheet>
    </Dialog.Root>
  );
}

export function ThemeRow({ theme }: { theme: "dark" | "light" }) {
  const [pending, start] = useTransition();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setTheme(next))}
      className={cn(ROW, "w-full text-left")}
    >
      <span>Theme · {theme === "dark" ? "Dark" : "Light"}</span>
      <span className="flex items-center gap-1.5 text-ink-muted">
        {next === "light" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        Switch to {next}
      </span>
    </button>
  );
}

export function DeleteAccountRow() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, { error: null });
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn(ROW, "w-full font-semibold text-wrong")}>Delete account</Dialog.Trigger>
      <Sheet
        title="Delete your account?"
        description="This removes your profile, courses, uploads, mock history, flashcards and payments record. Questions you contributed stay in the course bank without your name. This can't be undone."
      >
        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-ink-muted">
            Type DELETE to confirm
            <input
              name="confirm"
              autoComplete="off"
              autoCapitalize="characters"
              className="h-[52px] rounded-[12px] bg-surface-2 px-4 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-wrong"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-sm text-wrong">
              {state.error}
            </p>
          )}
          <SheetButtons pending={pending} confirm="Delete" danger />
        </form>
      </Sheet>
    </Dialog.Root>
  );
}

/** Confirm sheet: bottom sheet on phones, small modal on desktop. */
function Sheet({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim animate-[fade-in_200ms_ease-out]" />
      <Dialog.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col gap-4 rounded-t-3xl bg-surface px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 outline-none animate-[sheet-up_220ms_ease-out]",
          "lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:border-border lg:p-8 lg:animate-[fade-in_200ms_ease-out]",
        )}
      >
        <div aria-hidden className="h-1 w-10 self-center rounded-full bg-border lg:hidden" />
        <Dialog.Title className="font-display text-[22px] font-bold">{title}</Dialog.Title>
        <Dialog.Description className="text-[15px] leading-relaxed text-ink-muted">{description}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function SheetButtons({ pending, confirm, danger }: { pending: boolean; confirm: string; danger?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Dialog.Close type="button" className={buttonClass("secondary", "lg")}>
        Cancel
      </Dialog.Close>
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", danger && "bg-wrong text-on-accent")}>
        {pending ? "Saving…" : confirm}
      </button>
    </div>
  );
}
