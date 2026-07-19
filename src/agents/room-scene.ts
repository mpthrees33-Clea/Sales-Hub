/**
 * room-scene (WO-11) — thin by design: turns product data + user intent into
 * the structured generation request. The provider call happens in the RUNNER
 * as a recorded step, never as an agent-reachable external tool — the email
 * remains the only external effect in the system.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { EscalationError } from "@/harness/errors";
import { scopedTool } from "@/harness/tool";
import { MODELS } from "@/lib/ai/models";

const getProduct = scopedTool({
  name: "get_product",
  description: "Swatch URL, finish, family, and spec for prompt enrichment.",
  effect: "read",
  inputSchema: z.object({ productId: z.string().uuid() }),
  execute: async (input) => {
    const p = await db.query.products.findFirst({ where: eq(products.id, input.productId) });
    if (!p) throw new Error("product not found");
    return {
      data: {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        family: p.family,
        finish: p.finish,
        swatchBlobUrl: p.swatchBlobUrl,
      },
    };
  },
});

const outputSchema = z.object({
  generationRequest: z.object({
    productSwatchUrl: z.string(),
    roomPhotoUrl: z.string(),
    targetSurfaces: z.array(z.string()).min(1),
    styleNotes: z.string().optional(),
    promptText: z.string().min(20),
  }),
});

export type RoomSceneOutput = z.infer<typeof outputSchema>;

export const roomSceneAgent = defineAgent({
  name: "room-scene",
  description: "Composes a faithful reference-conditioned generation request for a room scene.",
  model: MODELS.frontier,
  inputSchema: z.object({
    productId: z.string().uuid(),
    roomPhotoBlobUrl: z.string().min(1),
    targetSurfaces: z.array(z.string()).min(1),
    styleNote: z.string().optional(),
  }),
  outputSchema,
  tools: [getProduct],
  maxSteps: 3,
  systemPrompt: () =>
    [
      "Compose a faithful image-generation request applying an architectural film finish to a customer room photo.",
      "Describe the finish precisely from product data (e.g. 'walnut wood-grain architectural film, satin finish, vertical grain').",
      "Never add brand names, text, people, or watermarks to the prompt. Keep the room's identity intact — lighting, geometry, reflections, all other materials preserved.",
      "Output JSON {generationRequest:{productSwatchUrl, roomPhotoUrl, targetSurfaces, styleNotes?, promptText}}.",
    ].join("\n"),
  demoScript: async ({ input, tools }) => {
    const p = (await tools.get_product!({ productId: input.productId })) as {
      name: string;
      family: string;
      finish: string;
      swatchBlobUrl: string | null;
    };
    if (!p.swatchBlobUrl) throw new EscalationError("product_missing_swatch", { productId: input.productId });
    const finishDesc = `${p.name.toLowerCase()} ${p.family === "wood" ? "wood-grain" : p.family} architectural film, ${p.finish.toLowerCase()}`;
    const surfaces = input.targetSurfaces.join(", ");
    return {
      generationRequest: {
        productSwatchUrl: p.swatchBlobUrl,
        roomPhotoUrl: input.roomPhotoBlobUrl,
        targetSurfaces: input.targetSurfaces,
        styleNotes: input.styleNote,
        promptText:
          `Apply this ${finishDesc} (first reference image) to the ${surfaces} in this room (second reference image). ` +
          `Preserve the room's lighting, geometry, reflections, and all other materials.` +
          (input.styleNote ? ` ${input.styleNote}.` : "") +
          ` Photorealistic, no text or watermarks.`,
      },
    };
  },
});
