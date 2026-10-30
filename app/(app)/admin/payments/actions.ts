"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { isAdmin } from "@/lib/admin";
import { adminConfirm, adminReject } from "@/lib/transfers";
import { requireViewer } from "@/lib/viewer";

export async function resolveTransferAction(paymentId: string, action: "confirm" | "reject") {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) notFound();
  const db = await getDb();
  if (action === "confirm") await adminConfirm(db, paymentId, null);
  else await adminReject(db, paymentId);
  revalidatePath("/admin/payments");
}
