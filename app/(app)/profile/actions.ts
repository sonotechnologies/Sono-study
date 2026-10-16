"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { demoMode, signOut } from "@/lib/auth";
import { normaliseHandle } from "@/lib/identity";
import { requireViewer } from "@/lib/viewer";

const TOGGLES = ["anonymous", "notifyDailyReminder", "notifyStreak", "notifyChallenge"] as const;
export type ToggleSetting = (typeof TOGGLES)[number];

export async function updateToggle(setting: ToggleSetting, value: boolean) {
  if (!TOGGLES.includes(setting) || typeof value !== "boolean") throw new Error("Invalid setting");
  const viewer = await requireViewer();
  const db = await getDb();
  await db.update(users).set({ [setting]: value }).where(eq(users.id, viewer.id));
  revalidatePath("/profile");
  if (setting === "anonymous") revalidatePath("/leaderboard");
}

export async function updateReminderTime(time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid time");
  const viewer = await requireViewer();
  const db = await getDb();
  await db.update(users).set({ reminderTime: time }).where(eq(users.id, viewer.id));
  revalidatePath("/profile");
}

export interface HandleState {
  error: string | null;
  saved?: boolean;
}

export async function updateHandle(_prev: HandleState, form: FormData): Promise<HandleState> {
  const handle = normaliseHandle(String(form.get("handle") ?? ""));
  if (!handle) return { error: "3–20 characters: letters, numbers, dots and underscores." };
  const viewer = await requireViewer();
  const db = await getDb();
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.handle, handle), ne(users.id, viewer.id)));
  if (clash) return { error: `@${handle} is taken. Try another.` };
  await db.update(users).set({ handle }).where(eq(users.id, viewer.id));
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  return { error: null, saved: true };
}

export async function setTheme(theme: "dark" | "light") {
  (await cookies()).set("theme", theme === "light" ? "light" : "dark", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export interface DeleteState {
  error: string | null;
}

/** Deletes the account and everything that cascades from it (NDPA: right to erasure). */
export async function deleteAccount(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  if (form.get("confirm") !== "DELETE") return { error: 'Type DELETE to confirm.' };
  const viewer = await requireViewer();
  if (demoMode) return { error: "The demo account can't be deleted." };
  const db = await getDb();
  await db.delete(users).where(eq(users.id, viewer.id));
  await signOut({ redirect: false });
  redirect("/");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
