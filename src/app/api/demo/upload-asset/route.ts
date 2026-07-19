/** Marketing-asset upload (WO-10 task 4): type/size checked before Blob write; registered + audited. */
import { NextResponse, type NextRequest } from "next/server";
import { putBlob } from "@/lib/blob";
import { registerAsset } from "@/lib/assets";
import { REP } from "@/lib/rep";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: `unsupported type ${file.type} (pdf/png/jpg)` }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file exceeds 10 MB" }, { status: 413 });

  const title = String(form?.get("title") ?? file.name);
  const tags = String(form?.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const bytes = Buffer.from(await file.arrayBuffer());
  const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "asset";
  const key = `assets/uploads/${Date.now()}-${safe}${ext}`;
  const blobUrl = await putBlob(key, bytes, { contentType: file.type, maxBytes: MAX_BYTES });
  const { assetId } = await registerAsset({
    kind: "brochure",
    title,
    blobUrl,
    contentType: file.type,
    tags,
    actor: `user:${REP.id}`,
  });
  return NextResponse.json({ assetId, blobUrl });
}
