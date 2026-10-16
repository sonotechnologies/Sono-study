"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, FileText, Plus, X } from "lucide-react";
import { confirmUploadAction, prepareUploadAction } from "@/app/(app)/upload/actions";
import { Switch } from "@/components/ui/switch";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { ProgressCard } from "./progress-card";

type Course = { id: string; label: string };
type Photo = { id: string; file: File; url: string };

const DOC_ACCEPT =
  ".pdf,.pptx,.docx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Some phones give documents an empty or generic type: trust the extension. */
function docType(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return DOC_TYPES[ext] ?? file.type;
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Phone photos are 3–5 MB; 1600px JPEG keeps text readable at a fraction of the data. */
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 900_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

function put(url: string, headers: Record<string, string>, body: Blob, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Your connection dropped. Try again when you have signal."));
    xhr.send(body);
  });
}

export function UploadPicker({
  courses,
  defaultCourseId,
  schoolName,
  maxBytes,
  maxPhotos,
  pagesPerUpload,
}: {
  courses: Course[];
  defaultCourseId: string;
  schoolName: string | null;
  maxBytes: number;
  maxPhotos: number;
  pagesPerUpload: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"camera" | "files">("camera");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [doc, setDoc] = useState<File | null>(null);
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [contribute, setContribute] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | { label: string; sent: number; total: number }>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  // Free the preview images when leaving the screen.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const course = courses.find((c) => c.id === courseId);
  const code = course?.label.split(" · ")[0] ?? "this course";
  const ready = mode === "camera" ? photos.length > 0 : !!doc;

  function addPhotos(list: FileList | null) {
    setError(null);
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    const room = maxPhotos - photos.length;
    if (files.length > room) setError(`Up to ${maxPhotos} photos per upload.`);
    setPhotos((p) => [...p, ...files.slice(0, Math.max(0, room)).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return p.filter((x) => x.id !== id);
    });
  }

  function pickDoc(list: FileList | null) {
    setError(null);
    const file = list?.[0];
    if (!file) return;
    if (!Object.values(DOC_TYPES).includes(docType(file))) return setError("Use a PDF, PowerPoint (.pptx) or Word (.docx) file. For .ppt or .doc, save as the newer format first.");
    if (file.size > maxBytes) return setError(`That file is over ${Math.round(maxBytes / 1024 / 1024)} MB. Try a smaller export or photos.`);
    setDoc(file);
  }

  async function submit() {
    setError(null);
    try {
      setBusy({ label: "Getting your files ready", sent: 0, total: 0 });
      const blobs: { blob: Blob; name: string; type: string }[] =
        mode === "camera"
          ? await Promise.all(photos.map(async (p, i) => ({ blob: await shrinkPhoto(p.file), name: `photo-${i + 1}.jpg`, type: "image/jpeg" })))
          : [{ blob: doc!, name: doc!.name, type: docType(doc!) }];
      const total = blobs.reduce((s, b) => s + b.blob.size, 0);
      if (total > maxBytes) throw new Error(`Keep uploads under ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      const files = await Promise.all(blobs.map(async (b) => ({ name: b.name, type: b.type || b.blob.type, size: b.blob.size, hash: await sha256(b.blob) })));

      const prep = await prepareUploadAction({ courseId, contribute, files });
      if (!prep.ok) {
        if (prep.code === "limit" || prep.code === "ai_limit") return router.refresh();
        throw new Error(prep.error);
      }
      if (prep.reused) return router.push(`/upload/${prep.uploadId}`);

      const sent = new Array(blobs.length).fill(0);
      setBusy({ label: "Uploading", sent: 0, total });
      // One at a time: on a weak connection parallel uploads just fight each other.
      for (let i = 0; i < blobs.length; i++) {
        const t = prep.targets[i];
        await put(t.url, t.headers, blobs[i].blob, (loaded) => {
          sent[i] = loaded;
          setBusy({ label: "Uploading", sent: sent.reduce((a, b) => a + b, 0), total });
        });
      }
      const done = await confirmUploadAction(prep.uploadId);
      if (!done.ok) throw new Error(done.error);
      router.push(`/upload/${prep.uploadId}`);
    } catch (err) {
      setBusy(null);
      setError((err as Error).message || "Something went wrong. Try again.");
    }
  }

  if (busy) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-3 lg:px-0">
        <ProgressCard
          view={{ phase: "uploading", sizeBytes: busy.total, sent: busy.sent, statusLine: busy.label }}
        />
        <p className="text-sm leading-relaxed text-ink-muted">Keep this screen open until the upload finishes. After that you can leave.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-1 pb-5 lg:px-0">
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ["camera", Camera, "Camera", "Snap several pages"],
              ["files", FileText, "Files", "PDF, PPT, DOCX"],
            ] as const
          ).map(([m, Icon, label, hint]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
                (m === "camera" ? cameraRef : filesRef).current?.click();
              }}
              className={cn(
                "flex h-24 flex-col justify-between rounded-2xl border p-3.5 text-left",
                mode === m ? "border-accent bg-accent-soft" : "border-border bg-surface",
              )}
            >
              <Icon size={22} className={mode === m ? "text-accent" : "text-ink-muted"} aria-hidden />
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{label}</span>
                <span className="text-xs text-ink-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => (addPhotos(e.target.files), (e.target.value = ""))} />
        <input ref={filesRef} type="file" accept={DOC_ACCEPT} hidden onChange={(e) => (pickDoc(e.target.files), (e.target.value = ""))} />

        {mode === "camera" && photos.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">
                {photos.length} photo{photos.length === 1 ? "" : "s"} selected
              </span>
              {photos.length < maxPhotos && (
                <button type="button" onClick={() => cameraRef.current?.click()} className="flex h-9 items-center gap-1 font-semibold text-accent">
                  <Plus size={16} aria-hidden /> Add more
                </button>
              )}
            </div>
            <ol className="grid grid-cols-4 gap-1.5">
              {photos.map((p, i) => (
                <li key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-[10px] border border-border bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={p.url} alt={`Page ${i + 1}`} className="size-full object-cover" />
                  <span className="absolute right-1 top-1 grid size-[18px] place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute bottom-1 left-1 grid size-7 place-items-center rounded-full bg-scrim text-white"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
        {mode === "camera" && photos.length === 0 && (
          <button type="button" onClick={() => cameraRef.current?.click()} className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">
            Take a photo of each page of your notes or past questions, in order. Up to {Math.min(maxPhotos, pagesPerUpload)} pages.
          </button>
        )}
        {mode === "files" && (
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            className={cn("flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left", doc ? "border border-border bg-surface" : "border border-dashed border-border text-ink-muted")}
          >
            <FileText size={22} className="flex-none text-ink-muted" aria-hidden />
            {doc ? (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-semibold">{doc.name}</span>
                <span className="text-[13px] text-ink-muted">{(doc.size / 1024 / 1024).toFixed(1)} MB · tap to change</span>
              </span>
            ) : (
              <span className="text-sm">Choose a PDF, PowerPoint or Word file (up to {pagesPerUpload} pages are read on your plan)</span>
            )}
          </button>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-muted">Course</span>
          <span className="relative">
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-[52px] w-full appearance-none rounded-[12px] bg-surface-2 pl-3.5 pr-10 text-base text-ink outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
          </span>
        </label>

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5">
          <label htmlFor="contribute" className="flex flex-1 flex-col gap-1">
            <span className="text-[15px] font-semibold">Share with your class</span>
            <span className="text-[13px] leading-normal text-ink-muted">
              Questions (not your {mode === "camera" ? "photos" : "file"}) join the {code} bank{schoolName ? ` for ${schoolName}` : ""}. You earn +50 XP when classmates use them.
            </span>
          </label>
          <Switch id="contribute" checked={contribute} onCheckedChange={setContribute} />
        </div>

        {error && (
          <p role="alert" className="text-sm text-wrong">
            {error}
          </p>
        )}
      </div>
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] bg-bg px-5 pb-5 pt-3 lg:static lg:px-0">
        <button type="button" disabled={!ready || !courseId} onClick={submit} className={buttonClass("primary", "lg", "w-full")}>
          Make questions
        </button>
      </div>
    </div>
  );
}
