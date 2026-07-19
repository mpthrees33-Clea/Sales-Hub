/**
 * WO-11 acceptance: seeded hero scenes present, prompt-composition snapshot,
 * keyless fixture fallback, scene→asset registration passing isAttachable,
 * per-demo-day cap enforcement, and the grep guarantee that the imagegen
 * provider is reachable only from the studio runner.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentSteps, auditLog, products, roomScenes } from "@/db/schema";
import { roomSceneAgent, type RoomSceneOutput } from "@/agents/room-scene";
import { isAttachable, registerAsset } from "@/lib/assets";
import { blobExists } from "@/lib/blob";
import { dayBounds } from "@/lib/dates";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { SCENE_CONFIG } from "@/lib/scene-limits";
import { generateRoomScene } from "@/lib/scenes";
import { sid } from "@/db/seed/ids";
import { DEMO_NOW } from "@/db/seed/scenario";

const HERO_ID = sid("product:MS-WG-1147");
const SEEDED_SCENE_IDS = [sid("scene:hero-walnut-lobby"), sid("scene:hero-steel-conference")];

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  // Idempotent re-runs: drop everything the previous test run generated.
  await db.delete(roomScenes).where(notInArray(roomScenes.id, SEEDED_SCENE_IDS));
  await db.execute(sql`delete from assets where kind = 'scene'`);
});

describe("seeded gallery", () => {
  it("shows the two hero scenes with resolvable output blobs after pnpm seed", async () => {
    const rows = await db.query.roomScenes.findMany({ where: eq(roomScenes.status, "complete") });
    const ids = rows.map((r) => r.id);
    for (const seeded of SEEDED_SCENE_IDS) expect(ids).toContain(seeded);
    const walnut = rows.find((r) => r.id === SEEDED_SCENE_IDS[0])!;
    expect(walnut.outputBlobUrl).toBe("/api/blob/scenes/hero-walnut-lobby.svg");
    expect(await blobExists("scenes/hero-walnut-lobby.svg")).toBe(true);
    expect(await blobExists("rooms/lobby.svg")).toBe(true);
  });
});

describe("prompt composition (room-scene agent)", () => {
  it("composes the faithful reference-conditioned prompt for a known input", async () => {
    const run = await roomSceneAgent.run(
      {
        productId: HERO_ID,
        roomPhotoBlobUrl: "/api/blob/rooms/lobby.svg",
        targetSurfaces: ["feature wall", "reception desk"],
      },
      { trigger: "user" },
    );
    expect(run.status).toBe("succeeded");
    const req = (run.output as RoomSceneOutput).generationRequest;
    const hero = await db.query.products.findFirst({ where: eq(products.id, HERO_ID) });
    expect(req.productSwatchUrl).toBe(hero!.swatchBlobUrl);
    expect(req.roomPhotoUrl).toBe("/api/blob/rooms/lobby.svg");
    expect(req.targetSurfaces).toEqual(["feature wall", "reception desk"]);
    expect(req.promptText).toBe(
      "Apply this walnut grain wood-grain architectural film, satin wood grain (first reference image) " +
        "to the feature wall, reception desk in this room (second reference image). " +
        "Preserve the room's lighting, geometry, reflections, and all other materials. " +
        "Photorealistic, no text or watermarks.",
    );
  });

  it("appends the style note before the fidelity clause", async () => {
    const run = await roomSceneAgent.run(
      {
        productId: HERO_ID,
        roomPhotoBlobUrl: "/api/blob/rooms/lobby.svg",
        targetSurfaces: ["ceiling"],
        styleNote: "warm evening lighting",
      },
      { trigger: "user" },
    );
    expect(run.status).toBe("succeeded");
    const req = (run.output as RoomSceneOutput).generationRequest;
    expect(req.promptText).toContain("to the ceiling in this room");
    expect(req.promptText).toContain("all other materials. warm evening lighting. Photorealistic");
  });
});

describe("keyless fixture fallback + asset registration", () => {
  it(
    "generates via the demo provider, records a generate_scene step, and the registered asset is attachable",
    { timeout: 30_000 },
    async () => {
      const result = await generateRoomScene({
        productId: HERO_ID,
        roomPhotoBlobUrl: "/api/blob/rooms/lobby.svg",
        targetSurfaces: ["feature wall"],
        actor: "user:test",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.model).toBe("demo/fixture-composite");
      expect(await blobExists(result.outputBlobUrl.replace("/api/blob/", ""))).toBe(true);

      const scene = await db.query.roomScenes.findFirst({ where: eq(roomScenes.id, result.sceneId) });
      expect(scene!.status).toBe("complete");
      expect(scene!.prompt).toContain("walnut grain wood-grain architectural film");

      // The provider call is a recorded runner-side step, not an agent tool.
      const steps = await db.query.agentSteps.findMany({ where: eq(agentSteps.name, "generate_scene") });
      expect(steps.length).toBeGreaterThanOrEqual(1);

      const audits = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.action, "scene.generated"), eq(auditLog.objectId, result.sceneId)));
      expect(audits).toHaveLength(1);

      // "Attach to reply" path: register → immediately attachable by the policy gate.
      const { assetId } = await registerAsset({
        kind: "scene",
        title: "Walnut Grain — feature wall",
        blobUrl: result.outputBlobUrl,
        contentType: "image/svg+xml",
        tags: ["scene", "wood"],
        productIds: [HERO_ID],
        actor: "user:test",
      });
      expect(await isAttachable(assetId)).toBe(true);
    },
  );
});

describe("cap enforcement", () => {
  it("refuses the 11th generation of the demo-day before composing anything", async () => {
    const { start, end } = dayBounds(DEMO_NOW);
    const [today] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(roomScenes)
      .where(and(gte(roomScenes.createdAt, start), lte(roomScenes.createdAt, end)));
    const filler = SCENE_CONFIG.perDayCap - (today?.n ?? 0);
    if (filler > 0) {
      await db.insert(roomScenes).values(
        Array.from({ length: filler }, (_, i) => ({
          productId: HERO_ID,
          sourcePhotoBlobUrl: "/api/blob/rooms/lobby.svg",
          prompt: `cap filler ${i}`,
          targetSurfaces: ["feature wall"],
          status: "failed" as const,
          createdAt: DEMO_NOW,
        })),
      );
    }

    const refused = await generateRoomScene({
      productId: HERO_ID,
      roomPhotoBlobUrl: "/api/blob/rooms/lobby.svg",
      targetSurfaces: ["feature wall"],
      actor: "user:test",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.capReached).toBe(true);
    expect(refused.error).toContain(`${SCENE_CONFIG.perDayCap}`);

    const [after] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(roomScenes)
      .where(and(gte(roomScenes.createdAt, start), lte(roomScenes.createdAt, end)));
    expect(after?.n).toBe(SCENE_CONFIG.perDayCap);
  });
});

describe("provider reachability", () => {
  it("getImageGenProvider is imported only by the studio runner (no batch path)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        if (p.includes("src/providers/")) continue; // definitions live here
        if (readFileSync(p, "utf8").includes("getImageGenProvider")) offenders.push(p.replace(/^.*src\//, "src/"));
      }
    };
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual(["src/lib/scenes.ts"]);
    // And the nightly dispatcher never touches the scene runner.
    const nightly = readFileSync(join(process.cwd(), "src/lib/nightly-dispatch.ts"), "utf8");
    expect(nightly.includes("lib/scenes")).toBe(false);
  });
});
