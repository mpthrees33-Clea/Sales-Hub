/**
 * WO-11: image generation is capped per demo-day. Seed's hero scenes are dated
 * on an earlier day so they never consume today's budget; the (cap+1)th
 * generation of a demo day is refused.
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { db } from "@/db/client";
import { roomScenes } from "@/db/schema";
import { getDemoNow } from "@/lib/demo-clock";
import { assertSceneQuota, SceneCapError, sceneQuota, SCENE_DAILY_CAP } from "@/lib/scene-limits";
import { sid } from "@/db/seed/ids";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("scene generation cap", () => {
  it("seed hero scenes do not count against the current demo day", async () => {
    const q = await sceneQuota();
    expect(q.used).toBe(0);
    expect(q.capReached).toBe(false);
    expect(q.remaining).toBe(SCENE_DAILY_CAP);
  });

  it("refuses the (cap+1)th generation of a demo day", async () => {
    const now = await getDemoNow();
    const productId = sid("product:MS-WG-1147");
    for (let i = 0; i < SCENE_DAILY_CAP; i++) {
      await db.insert(roomScenes).values({
        productId,
        sourcePhotoBlobUrl: "/api/blob/rooms/lobby.svg",
        outputBlobUrl: "/api/blob/scenes/hero-walnut-lobby.svg",
        prompt: "cap fixture",
        targetSurfaces: ["feature wall"],
        status: "complete",
        model: "demo/test",
        durationMs: 10,
        createdAt: now,
      });
    }
    const q = await sceneQuota();
    expect(q.used).toBe(SCENE_DAILY_CAP);
    expect(q.remaining).toBe(0);
    expect(q.capReached).toBe(true);
    await expect(assertSceneQuota()).rejects.toBeInstanceOf(SceneCapError);
  });
});
