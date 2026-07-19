/**
 * Live ImageGenProvider — Gemini image model, reference-conditioned edit:
 * both the product swatch and the room photo go in as input images (WO-11
 * task 1). One retry; failures surface as designed error states upstream.
 */
import { MODELS } from "@/lib/ai/models";
import { getBlobBuffer, putBlob } from "@/lib/blob";
import { env } from "@/lib/env";
import type { GenerateSceneInput, GenerateSceneResult, ImageGenProvider } from "./types";

const GEMINI_MODEL = "gemini-3-pro-image";

export class GeminiImageGenProvider implements ImageGenProvider {
  async generateScene(input: GenerateSceneInput): Promise<GenerateSceneResult> {
    if (!env.GEMINI_API_KEY) {
      throw new Error("Live scene generation requires GEMINI_API_KEY (demo fixtures serve otherwise)");
    }
    const t0 = Date.now();
    const [swatch, room] = await Promise.all([
      getBlobBuffer(input.productSwatchUrl),
      getBlobBuffer(input.roomPhotoUrl),
    ]);
    const attempt = async (): Promise<Buffer> => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: input.promptText },
                  { inlineData: { mimeType: mimeFor(input.productSwatchUrl), data: swatch.toString("base64") } },
                  { inlineData: { mimeType: mimeFor(input.roomPhotoUrl), data: room.toString("base64") } },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(60_000),
        },
      );
      if (!res.ok) throw new Error(`Gemini image generation failed: ${res.status}`);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
      };
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part?.inlineData) throw new Error("Gemini returned no image data");
      return Buffer.from(part.inlineData.data, "base64");
    };

    let image: Buffer;
    try {
      image = await attempt();
    } catch {
      image = await attempt(); // one retry (WO-11 task 1)
    }
    const key = `scenes/live-${Date.now()}.png`;
    const url = await putBlob(key, image, { contentType: "image/png", maxBytes: 20 * 1024 * 1024 });
    return { imageBlobUrl: url, model: MODELS.image, durationMs: Date.now() - t0 };
  }
}

function mimeFor(url: string): string {
  if (url.endsWith(".svg")) return "image/svg+xml";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  if (url.endsWith(".webp")) return "image/webp";
  return "image/png";
}
