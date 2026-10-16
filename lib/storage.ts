import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { AwsClient } from "aws4fetch";

/**
 * Private file storage for uploaded notes (ported from SonoCBT's lib/storage.ts).
 * Files are never public: the phone uploads straight to Cloudflare R2 with a
 * signed URL that expires in 10 minutes, and only the background job reads them.
 * Without R2 settings (development only) files go to a local folder through
 * /api/uploads/local, signed the same way.
 */

export const SIGNED_URL_TTL_SEC = 600;

/** What students can upload. Photos are resized on the phone before upload. */
export const UPLOAD_TYPES = {
  "application/pdf": { ext: "pdf", kind: "pdf" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", kind: "pptx" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", kind: "docx" },
  "image/jpeg": { ext: "jpg", kind: "photo" },
  "image/png": { ext: "png", kind: "photo" },
  "image/webp": { ext: "webp", kind: "photo" },
} as const;
export type UploadMime = keyof typeof UPLOAD_TYPES;

export function isUploadMime(type: string): type is UploadMime {
  return type in UPLOAD_TYPES;
}

export class StorageError extends Error {}

function r2() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return {
    client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
  };
}

export function storageMode(): "r2" | "local" | "none" {
  if (r2()) return "r2";
  return process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1" ? "none" : "local";
}

/**
 * Outside the source tree. Built so Turbopack can't trace it: a traced path under
 * .next/cache puts that folder (where dev PGlite writes on every request) under watch,
 * and dev reloads in a loop.
 */
export const localStorageDir = () => process.env.LOCAL_STORAGE_DIR ?? [process.cwd(), ".next", "cache", "uploads"].join(path.sep);

/**
 * fs is loaded out of Turbopack's sight: with dynamic paths it would otherwise trace the
 * whole project as a dependency, and the dev server rebuilds on every log write.
 */
const fs = (): Promise<typeof import("node:fs/promises")> => import(/* turbopackIgnore: true */ /* webpackIgnore: true */ "node:fs/promises");

const KEY = /^uploads\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.(pdf|pptx|docx|jpg|png|webp)$/;

export function newObjectKey(userId: string, mime: UploadMime): string {
  const safeUser = userId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `uploads/${safeUser}/${randomUUID()}.${UPLOAD_TYPES[mime].ext}`;
}

function localSecret() {
  return process.env.AUTH_SECRET || "sono-local-storage-dev";
}

function localSignature(key: string, contentType: string, exp: number) {
  return createHmac("sha256", localSecret()).update(`${key}\n${contentType}\n${exp}`).digest("hex");
}

export function verifyLocalSignature(key: string, contentType: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!KEY.test(key) || !Number.isFinite(exp) || exp * 1000 < now) return false;
  const want = Buffer.from(localSignature(key, contentType, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export interface SignedPut {
  key: string;
  url: string;
  headers: Record<string, string>;
}

/** A short-lived URL the phone PUTs the file to. */
export async function signedPutUrl(key: string, contentType: string): Promise<SignedPut> {
  if (!KEY.test(key)) throw new StorageError("Bad file key.");
  const remote = r2();
  if (remote) {
    const url = new URL(`${remote.endpoint}/${key}`);
    url.searchParams.set("X-Amz-Expires", String(SIGNED_URL_TTL_SEC));
    const signed = await remote.client.sign(new Request(url, { method: "PUT", headers: { "Content-Type": contentType } }), {
      aws: { signQuery: true, allHeaders: true },
    });
    return { key, url: signed.url, headers: { "Content-Type": contentType } };
  }
  if (storageMode() === "none") throw new StorageError("File storage isn't set up yet.");
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SEC;
  const q = new URLSearchParams({ key, exp: String(exp), sig: localSignature(key, contentType, exp) });
  return { key, url: `/api/uploads/local?${q}`, headers: { "Content-Type": contentType } };
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (!KEY.test(key)) throw new StorageError("Bad file key.");
  const remote = r2();
  if (remote) {
    const res = await remote.client.fetch(`${remote.endpoint}/${key}`, {
      method: "PUT",
      body: new Blob([new Uint8Array(body)], { type: contentType }),
      headers: { "Content-Type": contentType },
    });
    if (!res.ok) throw new StorageError(`Storage refused the file (${res.status}).`);
    return;
  }
  if (storageMode() === "none") throw new StorageError("File storage isn't set up yet.");
  const target = path.join(localStorageDir(), key);
  const { mkdir, writeFile } = await fs();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

export async function readObject(key: string): Promise<Uint8Array | null> {
  if (!KEY.test(key)) return null;
  const remote = r2();
  if (remote) {
    const res = await remote.client.fetch(`${remote.endpoint}/${key}`);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  }
  try {
    return new Uint8Array(await (await fs()).readFile(path.join(localStorageDir(), key)));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!KEY.test(key)) return;
  const remote = r2();
  if (remote) {
    await remote.client.fetch(`${remote.endpoint}/${key}`, { method: "DELETE" });
    return;
  }
  await (await fs()).rm(path.join(localStorageDir(), key), { force: true });
}
