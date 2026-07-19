/** Room-photo upload for the scene studio (WO-11 task 4). Auth'd; png/jpg ≤ 10 MB, checked before Blob write. Stored under rooms/, not registered as an attachable asset. */
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { putBlob } from "@/lib/blob";
import { getDemoNow } from "@/lib/demo-clock";

export const dynamic = "force-dynamic";
const MAX = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(req: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "PNG, JPG, or WebP only" }, { status: 415 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX) return NextResponse.json({ error: "file exceeds 10 MB" }, { status: 413 });

  const now = await getDemoNow();
  const key = `rooms/upload-${now.getTime()}.${ext}`;
  const blobUrl = await putBlob(key, bytes, { contentType: file.type, maxBytes: MAX });
  return NextResponse.json({ blobUrl });
}
