/**
 * PO Intake dropzone (WO-06 task 14b). Authenticated POST (middleware guards
 * /api/workflows/*). Accepts a single PDF ≤ 10 MB, type/size-checked BEFORE the
 * Blob write (docs/02 §5), stores it, and runs the same pipeline.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { putBlob } from "@/lib/blob";
import { getDemoNow } from "@/lib/demo-clock";
import { startPoIntake } from "./start";

export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDF only" }, { status: 415 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: "file exceeds 10 MB" }, { status: 413 });

  const now = await getDemoNow();
  const key = `po/upload-${now.getTime()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`.replace(/\.pdf$/i, "") + ".pdf";
  const blobUrl = await putBlob(key, bytes, { contentType: "application/pdf", maxBytes: MAX_BYTES });
  const result = await startPoIntake({ blobUrl });
  return NextResponse.json(result);
}
