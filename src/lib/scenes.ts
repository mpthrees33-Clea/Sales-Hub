/**
 * Scene generation runner (WO-11 task 2): agent composes the request; the
 * provider call executes HERE as a recorded step on the run — no batch or
 * nightly code path imports this module (grep-enforced: studio-only).
 */
import { eq, sql } from "drizzle-orm";
import { roomSceneAgent, type RoomSceneOutput } from "@/agents/room-scene";
import { db } from "@/db/client";
import { agentSteps, roomScenes } from "@/db/schema";
import { audit } from "@/lib/audit";
import { sceneBudget } from "@/lib/scene-limits";
import { getImageGenProvider } from "@/providers";

export type GenerateSceneResult =
  | { ok: true; sceneId: string; outputBlobUrl: string; durationMs: number; model: string }
  | { ok: false; error: string; capReached?: boolean };

export async function generateRoomScene(input: {
  productId: string;
  roomPhotoBlobUrl: string;
  targetSurfaces: string[];
  styleNote?: string;
  actor: `user:${string}`;
}): Promise<GenerateSceneResult> {
  const budget = await sceneBudget();
  if (budget.remaining <= 0) {
    return { ok: false, capReached: true, error: `Daily cap reached (${budget.cap} scenes per demo-day).` };
  }

  const run = await roomSceneAgent.run(
    {
      productId: input.productId,
      roomPhotoBlobUrl: input.roomPhotoBlobUrl,
      targetSurfaces: input.targetSurfaces,
      styleNote: input.styleNote,
    },
    { trigger: "user" },
  );
  if (run.status !== "succeeded" || !run.output) {
    return { ok: false, error: run.escalation?.reason ?? "prompt composition failed" };
  }
  const req = (run.output as RoomSceneOutput).generationRequest;

  const [scene] = await db
    .insert(roomScenes)
    .values({
      productId: input.productId,
      sourcePhotoBlobUrl: req.roomPhotoUrl,
      prompt: req.promptText,
      targetSurfaces: req.targetSurfaces,
      status: "generating",
    })
    .returning({ id: roomScenes.id });

  try {
    const result = await getImageGenProvider().generateScene({
      productSwatchUrl: req.productSwatchUrl,
      roomPhotoUrl: req.roomPhotoUrl,
      targetSurfaces: req.targetSurfaces,
      styleNotes: req.styleNotes,
      promptText: req.promptText,
    });
    // Record the provider call as a step on the composing run — the model
    // never held a generation tool; this is runner-side media creation.
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${agentSteps.seq}), 0)::int` })
      .from(agentSteps)
      .where(eq(agentSteps.runId, run.runId));
    await db.insert(agentSteps).values({
      runId: run.runId,
      seq: (maxRow?.max ?? 0) + 1,
      kind: "tool_call",
      name: "generate_scene",
      input: { targetSurfaces: req.targetSurfaces },
      output: { model: result.model },
      durationMs: result.durationMs,
    });
    await db
      .update(roomScenes)
      .set({ outputBlobUrl: result.imageBlobUrl, status: "complete", model: result.model, durationMs: result.durationMs })
      .where(eq(roomScenes.id, scene!.id));
    await audit({
      actor: input.actor,
      action: "scene.generated",
      objectType: "room_scene",
      objectId: scene!.id,
      detail: { model: result.model, durationMs: result.durationMs, surfaces: req.targetSurfaces },
    });
    return { ok: true, sceneId: scene!.id, outputBlobUrl: result.imageBlobUrl, durationMs: result.durationMs, model: result.model };
  } catch (err) {
    await db.update(roomScenes).set({ status: "failed" }).where(eq(roomScenes.id, scene!.id));
    await audit({
      actor: input.actor,
      action: "scene.failed",
      objectType: "room_scene",
      objectId: scene!.id,
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return { ok: false, error: err instanceof Error ? err.message : "generation failed" };
  }
}
