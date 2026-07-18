import type { TranscriptSegment } from "@/db/schema";

export interface TranscriptionProvider {
  /** Diarized transcription of an audio blob. */
  transcribe(blobUrl: string): Promise<{ segments: TranscriptSegment[] }>;
}
