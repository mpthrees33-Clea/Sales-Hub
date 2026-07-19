/**
 * Meeting audio upload (WO-07 task 2): recorder blob or file input →
 * type/size checked server-side → Blob → pipeline. Session required
 * (middleware).
 */
import { NextResponse, type NextRequest } from "next/server";
import { putBlob } from "@/lib/blob";
import { meetingPipeline } from "@/app/api/workflows/transcribe/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "multipart form with an `audio` field required" }, { status: 400 });
  }
  const baseType = file.type.split(";")[0] ?? "";
  const ext = ALLOWED[baseType];
  if (!ext) {
    return NextResponse.json({ error: `unsupported audio type ${file.type} (webm/m4a/mp3/wav)` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio exceeds 100 MB" }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const key = `meetings/${meetingId}-${Date.now()}${ext}`;
  const blobUrl = await putBlob(key, bytes, { contentType: baseType === "audio/mp4" ? "audio/mp4" : baseType, maxBytes: MAX_BYTES });

  const result = await meetingPipeline(meetingId, blobUrl, { trigger: "user" });
  return NextResponse.json(result);
}
