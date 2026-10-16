import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { TopBar } from "@/components/account/top-bar";
import { UploadStatus } from "@/components/upload/status";
import { getUploadView } from "@/lib/uploads";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Your questions" };

export default async function UploadStatusPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const view = await getUploadView(await getDb(), viewer.id, id);
  if (!view) notFound();
  const heading = view.type === "photos" ? `${view.courseCode} · ${view.title}` : view.courseCode;
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-[720px] flex-col lg:min-h-0 lg:pt-6">
      <TopBar back="/upload" heading={heading} />
      {error && (
        <p role="alert" className="mx-5 rounded-[12px] bg-wrong-soft px-3.5 py-3 text-sm lg:mx-0">
          {error}
        </p>
      )}
      <UploadStatus initial={view} />
    </main>
  );
}
