/** Marketing-asset upload (WO-10 task 4). Auth'd; pdf/png/jpg ≤ 20 MB, checked before Blob write; registers + audits. */
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { putBlob } from "@/lib/blob";
import { getDemoNow } from "@/lib/demo-clock";
import { registerAsset } from "@/lib/assets";

export const dynamic = "force-dynamic";
const MAX = 20 * 1024 * 1024;
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

export async function POST(req: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "PDF, PNG, or JPG only" }, { status: 415 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX) return NextResponse.json({ error: "file exceeds 20 MB" }, { status: 413 });

  const now = await getDemoNow();
  const key = `assets/upload-${now.getTime()}.${ext}`;
  const blobUrl = await putBlob(key, bytes, { contentType: file.type, maxBytes: MAX });
  const id = await registerAsset({ kind: "brochure", title: title || file.name, blobUrl, contentType: file.type, tags: ["uploaded"] });
  return NextResponse.json({ id, blobUrl });
}
