/**
 * WO-11: the studio runner composes a faithful prompt, generates via the
 * ImageGen provider (demo fixture path when no GEMINI_API_KEY), records the
 * generation as an internal generate_scene step on the agent run, and — once
 * registered — the scene passes the attachment-origin check.
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentSteps, roomScenes } from "@/db/schema";
import { composePrompt } from "@/agents/room-scene";
import { isAttachable } from "@/lib/assets";
import { generateRoomScene, registerSceneAsAsset } from "@/lib/scenes";
import { REP } from "@/lib/rep";
import { sid } from "@/db/seed/ids";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("composePrompt", () => {
  it("names the material and target surfaces and forbids text/brands/watermarks", () => {
    const p = composePrompt({ name: "Walnut Grain", finish: "Satin", family: "wood" }, ["feature wall", "reception desk"]);
    expect(p.toLowerCase()).toContain("walnut grain");
    expect(p.toLowerCase()).toContain("satin");
    expect(p).toContain("feature wall, reception desk");
    expect(p).toMatch(/no added text, people, brand marks, or watermarks/);
  });
});

describe("generateRoomScene — demo fixture fallback (no GEMINI_API_KEY)", () => {
  it("renders a scene, records a generate_scene step, and is attachable after registration", async () => {
    const productId = sid("product:MS-WG-1147");
    const { sceneId, runId } = await generateRoomScene({
      productId,
      roomPhotoBlobUrl: "/api/blob/rooms/lobby.svg",
      targetSurfaces: ["feature wall"],
      userId: REP.id,
    });

    const scene = await db.query.roomScenes.findFirst({ where: eq(roomScenes.id, sceneId) });
    expect(scene?.status).toBe("complete");
    expect(scene?.outputBlobUrl).toBeTruthy();
    expect(scene?.model ?? "").toContain("demo"); // fixture path, not live gemini

    const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, runId));
    expect(steps.some((s) => s.name === "generate_scene" && s.kind === "tool_call")).toBe(true);

    const first = await registerSceneAsAsset(sceneId, REP.id);
    expect(first.alreadyRegistered).toBe(false);
    expect(await isAttachable(first.assetId)).toBe(true);

    const again = await registerSceneAsAsset(sceneId, REP.id);
    expect(again.alreadyRegistered).toBe(true);
    expect(again.assetId).toBe(first.assetId);
  }, 20_000);
});
