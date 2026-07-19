/**
 * Room-scene studio runner (WO-11 task 2). Orchestrates one user-triggered
 * generation:
 *   1. enforce the per-demo-day cap (scene-limits),
 *   2. run the thin `room-scene` agent to compose a faithful generation request
 *      (recorded as its own agent_run),
 *   3. call the ImageGen provider — the ONE internal media effect — and record
 *      it as a `generate_scene` tool_call step ON that same run,
 *   4. persist the `room_scenes` row (dated on the demo clock so the cap stays
 *      coherent) + an audit row.
 * The provider is imported here and nowhere else — no nightly/batch path can
 * reach image generation.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentSteps, assets, products, roomScenes } from "@/db/schema";
import { roomSceneAgent } from "@/agents/room-scene";
import { registerAsset } from "@/lib/assets";
import { audit } from "@/lib/audit";
import { contentTypeForKey } from "@/lib/blob";
import { getDemoNow } from "@/lib/demo-clock";
import { assertSceneQuota } from "@/lib/scene-limits";
import { getImageGenProvider } from "@/providers";

export type GenerateRoomSceneInput = {
  productId: string;
  roomPhotoBlobUrl: string;
  targetSurfaces: string[];
  styleNote?: string;
  userId: string;
};

export async function generateRoomScene(input: GenerateRoomSceneInput): Promise<{ sceneId: string; runId: string }> {
  await assertSceneQuota();
  const demoNow = await getDemoNow();

  const run = await roomSceneAgent.run(
    { productId: input.productId, roomPhotoBlobUrl: input.roomPhotoBlobUrl, targetSurfaces: input.targetSurfaces, styleNote: input.styleNote },
    { trigger: "user" },
  );
  if (run.status !== "succeeded" || !run.output) {
    throw new Error(`scene request composition ${run.status}${run.escalation ? `: ${run.escalation.reason}` : ""}`);
  }
  const req = run.output.generationRequest;

  const provider = getImageGenProvider();
  const t0 = Date.now();
  let result;
  try {
    result = await provider.generateScene(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordGenerateStep(run.runId, { input: req, output: { error: message }, durationMs: Date.now() - t0 });
    await audit({ actor: `user:${input.userId}`, action: "scene.generation_failed", objectType: "room_scene", detail: { productId: input.productId, error: message } });
    throw err;
  }

  await recordGenerateStep(run.runId, {
    input: req,
    output: { imageBlobUrl: result.imageBlobUrl, model: result.model },
    durationMs: result.durationMs,
  });

  const [row] = await db
    .insert(roomScenes)
    .values({
      productId: input.productId,
      sourcePhotoBlobUrl: req.roomPhotoUrl,
      outputBlobUrl: result.imageBlobUrl,
      prompt: req.promptText,
      targetSurfaces: input.targetSurfaces,
      status: "complete",
      model: result.model,
      durationMs: result.durationMs,
      createdAt: demoNow,
    })
    .returning({ id: roomScenes.id });

  await audit({
    actor: `user:${input.userId}`,
    action: "scene.generated",
    objectType: "room_scene",
    objectId: row!.id,
    detail: { productId: input.productId, model: result.model, surfaces: input.targetSurfaces, durationMs: result.durationMs },
  });
  return { sceneId: row!.id, runId: run.runId };
}

/**
 * Register a completed scene as an attachable marketing asset (WO-11 task 6) so
 * it becomes legal for the attachment-origin policy check and appears in the
 * email drafting attachment picker. Idempotent by output blob URL.
 */
export async function registerSceneAsAsset(sceneId: string, userId: string): Promise<{ assetId: string; alreadyRegistered: boolean }> {
  const scene = await db.query.roomScenes.findFirst({ where: eq(roomScenes.id, sceneId) });
  if (!scene) throw new Error(`scene ${sceneId} not found`);
  if (!scene.outputBlobUrl) throw new Error(`scene ${sceneId} has no rendered image to attach`);

  const existing = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.kind, "scene"), eq(assets.blobUrl, scene.outputBlobUrl)))
    .limit(1);
  if (existing.length) return { assetId: existing[0]!.id, alreadyRegistered: true };

  const product = await db.query.products.findFirst({ where: eq(products.id, scene.productId) });
  const title = `Room scene — ${product?.name ?? "product"} (${scene.targetSurfaces.join(", ")})`;
  const assetId = await registerAsset({
    kind: "scene",
    title,
    blobUrl: scene.outputBlobUrl,
    contentType: contentTypeForKey(scene.outputBlobUrl),
    tags: ["scene", product?.family ?? "product"],
    productIds: [scene.productId],
  });
  await audit({ actor: `user:${userId}`, action: "scene.registered_asset", objectType: "room_scene", objectId: sceneId, detail: { assetId } });
  return { assetId, alreadyRegistered: false };
}

/** Append the internal generate_scene step onto the room-scene agent's run. */
async function recordGenerateStep(runId: string, entry: { input: unknown; output: unknown; durationMs: number }): Promise<void> {
  const rows = await db
    .select({ maxSeq: sql<number>`coalesce(max(${agentSteps.seq}), 0)` })
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId));
  await db.insert(agentSteps).values({
    runId,
    seq: Number(rows[0]?.maxSeq ?? 0) + 1,
    kind: "tool_call",
    name: "generate_scene",
    input: entry.input as Record<string, unknown>,
    output: entry.output as Record<string, unknown>,
    durationMs: Math.round(entry.durationMs),
  });
}
