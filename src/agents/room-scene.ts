/**
 * room-scene (WO-11) — thin by design. It turns a product + a room photo + the
 * rep's target surfaces into a faithful, reference-conditioned generation
 * request. It has ONE read tool (get_product) and no external-effect tools: the
 * actual image generation is an internal media step run by the studio runner
 * (src/lib/scenes.ts), never a model-reachable effect. The only external effect
 * in the whole system remains the outbound email.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { scopedTool } from "@/harness/tool";
import { MODELS } from "@/lib/ai/models";

type ProductCtx = {
  productId: string;
  sku: string;
  name: string;
  family: string;
  finish: string;
  description: string;
  swatchBlobUrl: string;
};

const getProduct = scopedTool<{ productId: string }>({
  name: "get_product",
  description: "Product finish, family, spec, and swatch URL — used to describe the material precisely in the prompt.",
  effect: "read",
  inputSchema: z.object({ productId: z.string() }),
  execute: async ({ productId }) => {
    const p = await db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!p) throw new Error(`product ${productId} not found`);
    const ctx: ProductCtx = {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      family: p.family,
      finish: p.finish,
      description: p.description,
      swatchBlobUrl: p.swatchBlobUrl ?? `/api/blob/swatches/${p.sku}.svg`,
    };
    return { data: { product: ctx }, evidence: [{ type: "product" as const, ref: { sku: p.sku }, quote: `${p.name} — ${p.finish}` }] };
  },
});

const generationRequest = z.object({
  productSwatchUrl: z.string(),
  roomPhotoUrl: z.string(),
  targetSurfaces: z.array(z.string()).min(1),
  styleNotes: z.string().optional(),
  promptText: z.string().min(1),
});

const outputSchema = z.object({ generationRequest });

/** Deterministic, faithful material description from product data. */
export function composePrompt(p: { name: string; finish: string; family: string }, targetSurfaces: string[], styleNote?: string): string {
  const material = `${p.name.toLowerCase()} ${p.family} architectural film with a ${p.finish.toLowerCase()} finish`;
  const surfaces = targetSurfaces.join(", ");
  const style = styleNote ? ` ${styleNote.trim()}` : "";
  return (
    `Apply this ${material} (first reference image) to the ${surfaces} in this room (second reference image). ` +
    `Preserve the room's existing lighting, geometry, reflections, and every other material and object exactly. ` +
    `Photorealistic architectural photography, no added text, people, brand marks, or watermarks.${style}`
  );
}

export const roomSceneAgent = defineAgent<
  { productId: string; roomPhotoBlobUrl: string; targetSurfaces: string[]; styleNote?: string },
  z.infer<typeof outputSchema>
>({
  name: "room-scene",
  description: "Compose a faithful, reference-conditioned image-generation request from a product + room + target surfaces. Read-only; generation runs in the studio runner.",
  model: MODELS.frontier,
  maxSteps: 3,
  inputSchema: z.object({
    productId: z.string(),
    roomPhotoBlobUrl: z.string(),
    targetSurfaces: z.array(z.string()).min(1),
    styleNote: z.string().optional(),
  }),
  outputSchema,
  tools: [getProduct],
  systemPrompt: () =>
    "Describe the finish precisely from product data (family, finish name). Keep the room's identity intact — you are re-surfacing named surfaces, not redesigning the space. " +
    "Never add brand names, text, people, or watermarks to the prompt. Output only the structured generationRequest.",
  demoScript: async ({ input, tools }) => {
    const { product } = (await tools.get_product!({ productId: input.productId })) as { product: ProductCtx };
    return {
      generationRequest: {
        productSwatchUrl: product.swatchBlobUrl,
        roomPhotoUrl: input.roomPhotoBlobUrl,
        targetSurfaces: input.targetSurfaces,
        styleNotes: input.styleNote,
        promptText: composePrompt(product, input.targetSurfaces, input.styleNote),
      },
    };
  },
});
