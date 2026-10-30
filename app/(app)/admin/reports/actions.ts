"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { isAdmin } from "@/lib/admin";
import { resolveReports } from "@/lib/reports";
import { requireViewer } from "@/lib/viewer";

export async function resolveReportAction(questionId: string, action: "restore" | "remove") {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) notFound();
  await resolveReports(await getDb(), questionId, action);
  revalidatePath("/admin/reports");
}
