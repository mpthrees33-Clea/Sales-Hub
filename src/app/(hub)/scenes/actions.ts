"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products, roomScenes } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { registerAsset } from "@/lib/assets";
import { generateRoomScene, type GenerateSceneResult } from "@/lib/scenes";

export async function generateScene(input: {
  productId: string;
  roomPhotoBlobUrl: string;
  targetSurfaces: string[];
  styleNote?: string;
}): Promise<GenerateSceneResult> {
  const session = await requireSession();
  const result = await generateRoomScene({ ...input, actor: `user:${session.userId}` });
  revalidatePath("/scenes");
  return result;
}

/** "Attach to reply" (WO-11 task 6): scenes become legal attachments via the library. */
export async function registerSceneAsAsset(sceneId: string): Promise<{ ok: boolean; assetId?: string; error?: string }> {
  const session = await requireSession();
  const scene = await db.query.roomScenes.findFirst({ where: eq(roomScenes.id, sceneId) });
  if (!scene?.outputBlobUrl) return { ok: false, error: "scene has no output" };
  const product = await db.query.products.findFirst({ where: eq(products.id, scene.productId) });
  const { assetId } = await registerAsset({
    kind: "scene",
    title: `${product?.name ?? "Scene"} — ${scene.targetSurfaces.join(", ")}`,
    blobUrl: scene.outputBlobUrl,
    contentType: scene.outputBlobUrl.endsWith(".svg") ? "image/svg+xml" : "image/png",
    tags: ["scene", ...(product ? [product.family] : [])],
    productIds: [scene.productId],
    actor: `user:${session.userId}`,
  });
  revalidatePath("/catalog/assets");
  return { ok: true, assetId };
}
