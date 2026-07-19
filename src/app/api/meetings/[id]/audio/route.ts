/**
 * Meeting audio upload (WO-07 task 2). Auth'd; accepts recorder blob or file
 * (webm/m4a/mp3), ≤100 MB, MIME + extension checked before Blob write (docs/02
 * §5), then starts the pipeline. In DEMO_MODE the transcript is the fixture.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { transcripts } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { putBlob } from "@/lib/blob";
import { getDemoNow } from "@/lib/demo-clock";
import { startMeetingPipeline } from "@/app/api/workflows/transcribe/start";

export const dynamic = "force-dynamic";
const MAX_BYTES = 100 * 1024 * 1024;
const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "unsupported audio type" }, { status: 415 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: "file exceeds 100 MB" }, { status: 413 });

  const now = await getDemoNow();
  const key = `meetings/${id}-${now.getTime()}.${ext}`;
  const blobUrl = await putBlob(key, bytes, { contentType: file.type === "audio/x-m4a" ? "audio/mp4" : file.type, maxBytes: MAX_BYTES });

  const existing = await db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, id) });
  if (existing) await db.update(transcripts).set({ audioBlobUrl: blobUrl }).where(eq(transcripts.id, existing.id));

  const result = await startMeetingPipeline({ meetingId: id, audioBlobUrl: blobUrl });
  return NextResponse.json(result);
}
