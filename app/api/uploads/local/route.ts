import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { MAX_UPLOAD_BYTES } from "@/lib/plans";
import { checkRateLimit, ipFrom, RateLimitError } from "@/lib/rate-limit";
import { putObject, storageMode, verifyLocalSignature } from "@/lib/storage";

/** Development stand-in for R2: accepts a PUT signed by lib/storage (same 10-minute expiry). */
export async function PUT(req: NextRequest) {
  if (storageMode() !== "local") return new NextResponse("Not found", { status: 404 });
  const p = req.nextUrl.searchParams;
  const key = p.get("key") ?? "";
  const contentType = req.headers.get("content-type") ?? "";
  if (!verifyLocalSignature(key, contentType, Number(p.get("exp")), p.get("sig") ?? "")) {
    return new NextResponse("Signature expired or invalid", { status: 403 });
  }
  try {
    await checkRateLimit(await getDb(), "uploadFile", { ip: ipFrom(req.headers) });
  } catch (err) {
    if (err instanceof RateLimitError) return new NextResponse(err.message, { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } });
    throw err;
  }
  const body = new Uint8Array(await req.arrayBuffer());
  if (!body.byteLength || body.byteLength > MAX_UPLOAD_BYTES) return new NextResponse("Bad size", { status: 413 });
  await putObject(key, body, contentType);
  return new NextResponse(null, { status: 200 });
}
