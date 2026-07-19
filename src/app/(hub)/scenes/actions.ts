"use server";

/** Room-scene studio actions (WO-11 tasks 4–6). */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { generateRoomScene, registerSceneAsAsset } from "@/lib/scenes";

export async function generateSceneAction(input: {
  productId: string;
  roomPhotoBlobUrl: string;
  targetSurfaces: string[];
  styleNote?: string;
}): Promise<{ sceneId: string }> {
  const { userId } = await requireSession();
  const { sceneId } = await generateRoomScene({ ...input, userId });
  revalidatePath("/scenes");
  return { sceneId };
}

export async function registerSceneAssetAction(sceneId: string): Promise<{ assetId: string; alreadyRegistered: boolean }> {
  const { userId } = await requireSession();
  const r = await registerSceneAsAsset(sceneId, userId);
  revalidatePath(`/scenes/${sceneId}`);
  revalidatePath("/catalog/assets");
  return r;
}
