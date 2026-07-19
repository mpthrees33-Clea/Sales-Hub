import type { TranscriptSegment } from "@/db/schema";
import { env } from "@/lib/env";
import type { TranscriptionProvider } from "./types";

/** AssemblyAI with diarization on (docs/APPENDIX §2.5 — bot-free capture). */
export class AssemblyAiTranscriptionProvider implements TranscriptionProvider {
  async transcribe(blobUrl: string): Promise<{ segments: TranscriptSegment[] }> {
    if (!env.ASSEMBLYAI_API_KEY) {
      throw new Error("AssemblyAI transcription requires ASSEMBLYAI_API_KEY (or set DEMO_MODE=true)");
    }
    const headers = { authorization: env.ASSEMBLYAI_API_KEY, "content-type": "application/json" };
    const create = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers,
      body: JSON.stringify({ audio_url: blobUrl, speaker_labels: true }),
    });
    if (!create.ok) throw new Error(`AssemblyAI create failed: ${create.status}`);
    const { id } = (await create.json()) as { id: string };
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, { headers });
      const data = (await poll.json()) as {
        status: string;
        error?: string;
        utterances?: { speaker: string; start: number; end: number; text: string }[];
      };
      if (data.status === "completed") {
        return {
          segments: (data.utterances ?? []).map((u) => ({
            speaker: u.speaker,
            t0: u.start / 1000,
            t1: u.end / 1000,
            text: u.text,
          })),
        };
      }
      if (data.status === "error") throw new Error(`AssemblyAI error: ${data.error}`);
    }
    throw new Error("AssemblyAI transcription timed out");
  }
}
