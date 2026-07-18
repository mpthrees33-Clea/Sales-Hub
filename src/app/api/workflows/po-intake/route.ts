/**
 * Dropzone upload → Blob → PO intake pipeline (WO-06 task 14b).
 * PDF only, ≤10 MB, type/size checked server-side BEFORE the blob write
 * (docs/02 §5). Session required (middleware).
 */
import { NextResponse, type NextRequest } from "next/server";
import { putBlob } from "@/lib/blob";
import { poIntake } from "./workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "multipart form with a `file` field required" }, { status: 400 });
  }
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "PDF only" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file exceeds 10 MB" }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  // Magic-byte check — extension and declared type are not enough.
  if (!bytes.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
    return NextResponse.json({ error: "not a valid PDF document" }, { status: 415 });
  }
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const key = `po/uploads/${Date.now()}-${safeName}`;
  const blobUrl = await putBlob(key, bytes, { contentType: "application/pdf", maxBytes: MAX_BYTES });

  const result = await poIntake(blobUrl, undefined, { trigger: "user" });
  return NextResponse.json(result);
}
