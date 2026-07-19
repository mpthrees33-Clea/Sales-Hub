import type { TranscriptSegment } from "@/db/schema";
import { getBlobBuffer } from "@/lib/blob";
import type { TranscriptionProvider } from "./types";

/** Blob key of the pre-baked diarized Harborview site-walk transcript fixture. */
export const DEMO_TRANSCRIPT_BLOB_KEY = "fixtures/transcript-harborview.json";

/**
 * Demo transcription returns the pre-baked diarized fixture (docs/01 §6) —
 * deterministic and instant, which is what gets filmed.
 */
export class DemoTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_blobUrl: string): Promise<{ segments: TranscriptSegment[] }> {
    const buf = await getBlobBuffer(`/api/blob/${DEMO_TRANSCRIPT_BLOB_KEY}`);
    const parsed = JSON.parse(buf.toString("utf8")) as { segments: TranscriptSegment[] };
    return { segments: parsed.segments };
  }
}
