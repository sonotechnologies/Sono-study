import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { uploads } from "@/db/schema";
import { readObject, signedGetUrl } from "@/lib/storage";
import { getViewerId } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * "Read next": opens the student's own notes at the right page. Files are private,
 * so only the uploader can open them; R2 hands out a 10-minute signed link.
 * ?n= picks the page (PDF) or photo number.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getViewerId();
  if (!userId) return new NextResponse("Sign in", { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const [u] = await db.select().from(uploads).where(and(eq(uploads.id, id), eq(uploads.userId, userId)));
  if (!u) return new NextResponse("Not found", { status: 404 });
  const n = Math.max(1, Number(req.nextUrl.searchParams.get("n")) || 1);
  const key = u.type === "photos" ? u.fileKeys[Math.min(n, u.fileKeys.length) - 1] : (u.fileKeys[0] ?? u.fileUrl);
  const hash = u.type === "pdf" ? `#page=${n}` : "";
  const signed = await signedGetUrl(key);
  if (signed) return NextResponse.redirect(signed + hash, { headers: { "Cache-Control": "no-store" } });
  const bytes = await readObject(key);
  if (!bytes) return new NextResponse("File not found", { status: 404 });
  const ext = key.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${u.title.replace(/[^\w .-]/g, "")}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
