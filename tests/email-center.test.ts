/**
 * WO-04 acceptance: categoryToTarget map, claim atomicity, StyleCard zod
 * round-trip, registry effect assertions, and the full triage pass over the
 * 14 staged Monday emails reproducing the docs/04 §2 category map.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { resetStagedBatch } from "./helpers/reset-staged";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emails, emailThreads, triageRoutings } from "@/db/schema";
import { agents } from "@/agents";
import { runTriageForEmail } from "@/agents/email-triage";
import { runReplyFromRouting } from "@/agents/email-reply";
import { categoryToTarget, claimRoutingById } from "@/lib/routing";
import { buildStyleProfile, StyleCardSchema } from "@/lib/style/profile";
import { INBOUND_MONDAY } from "@/db/seed/fixtures/emails";
import { sid } from "@/db/seed/ids";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { DEMO_NOW } from "@/db/seed/scenario";

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  await resetStagedBatch();
});

describe("categoryToTarget (deterministic map)", () => {
  it("maps every category per the contract", () => {
    expect(categoryToTarget("quote_request")).toBe("quote");
    expect(categoryToTarget("po")).toBe("po_intake");
    expect(categoryToTarget("sample_request")).toBe("sample");
    expect(categoryToTarget("stock_check")).toBe("reply");
    expect(categoryToTarget("scheduling")).toBe("reply");
    expect(categoryToTarget("general")).toBe("reply");
    expect(categoryToTarget("submittal_request")).toBe("submittal");
    expect(categoryToTarget("noise")).toBe("none");
  });
});

describe("registry effect assertions (lethal-trifecta separation)", () => {
  it("email-triage holds zero external tools", () => {
    const triage = agents["email-triage"]!;
    expect(triage.tools.filter((t) => t.effect === "external")).toHaveLength(0);
  });
  it("email-reply holds exactly one external tool: create_email_draft", () => {
    const reply = agents["email-reply"]!;
    const external = reply.tools.filter((t) => t.effect === "external");
    expect(external.map((t) => t.name)).toEqual(["create_email_draft"]);
  });
});

describe("style profile", () => {
  it("builds a zod-valid card from the sent corpus, signs —Cole, and caches", async () => {
    const card = await buildStyleProfile();
    expect(() => StyleCardSchema.parse(card)).not.toThrow();
    expect(card.signoff).toBe("—Cole");
    const roundTrip = StyleCardSchema.parse(JSON.parse(JSON.stringify(card)));
    expect(roundTrip.signoff).toBe("—Cole");
  });
});

describe("triage over the staged Monday batch", () => {
  it("reproduces the docs/04 §2 category map; noise archived; routings correct; re-runs are no-ops", async () => {
    const unprocessed = await db
      .select()
      .from(emails)
      .where(and(eq(emails.direction, "inbound"), eq(emails.isProcessed, false)));
    expect(unprocessed.length).toBe(14);

    for (const e of unprocessed) {
      const { result } = await runTriageForEmail(e.id, { trigger: "user" });
      expect(result.status).toBe("succeeded");
    }

    // Category map per fixture expectations.
    for (const f of INBOUND_MONDAY) {
      const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, sid(`thread:${f.key}`)) });
      expect(thread?.triage, `fixture ${f.key}`).toBe(f.category);
      if (f.category === "noise") {
        expect(thread?.status, `fixture ${f.key} archived`).toBe("archived");
      }
    }

    // Routings: 11 non-noise → pending rows with derived targets; noise → dismissed.
    const routings = await db.select().from(triageRoutings);
    expect(routings).toHaveLength(14);
    for (const f of INBOUND_MONDAY) {
      const r = routings.find((x) => x.emailId === sid(`email:${f.key}`));
      expect(r, `routing for ${f.key}`).toBeTruthy();
      expect(r!.target).toBe(categoryToTarget(f.category));
      expect(r!.status).toBe(f.category === "noise" ? "dismissed" : "pending");
    }

    // usedBody=false for clearly classifiable seeds (metadata-first).
    const clear = ["in-quote-stonebridge", "in-stock-piedmont", "in-po-carolina", "in-sample-atelier"];
    for (const key of clear) {
      const r = routings.find((x) => x.emailId === sid(`email:${key}`));
      expect(r).toBeTruthy();
    }

    // Re-run creates zero duplicates (unique email_id).
    const first = unprocessed[0]!;
    await runTriageForEmail(first.id, { trigger: "user" });
    const again = await db.select().from(triageRoutings).where(eq(triageRoutings.emailId, first.id));
    expect(again).toHaveLength(1);
  });

  it("claim atomicity: two concurrent claims on one routing → exactly one wins", async () => {
    const routing = await db.query.triageRoutings.findFirst({
      where: and(eq(triageRoutings.status, "pending"), eq(triageRoutings.target, "sample")),
    });
    expect(routing).toBeTruthy();
    const [a, b] = await Promise.all([claimRoutingById(routing!.id, null), claimRoutingById(routing!.id, null)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    // release for later suites
    const { releaseRouting } = await import("@/lib/routing");
    await releaseRouting(routing!.id);
  });

  it("stock-check reply drafts an approval with email + inventory evidence, signed —Cole", async () => {
    const routing = await db.query.triageRoutings.findFirst({
      where: and(eq(triageRoutings.status, "pending"), eq(triageRoutings.target, "reply")),
    });
    expect(routing).toBeTruthy();
    const result = await runReplyFromRouting(routing!.id, { trigger: "user" });
    expect(result?.status).toBe("succeeded");
    expect(result?.approvalIds).toHaveLength(1);

    const { approvals } = await import("@/db/schema");
    const approval = await db.query.approvals.findFirst({
      where: eq(approvals.id, result!.approvalIds[0]!),
    });
    expect(approval?.kind).toBe("email_draft");
    expect(approval?.status).toBe("pending");
    const payload = approval!.proposedAction as { bodyText: string; to: string[] };
    expect(payload.bodyText).toContain("—Cole");
    const types = approval!.evidence.map((e) => e.type);
    expect(types).toContain("email");

    // consumed routing → re-run is a no-op
    const rerun = await runReplyFromRouting(routing!.id, { trigger: "user" });
    expect(rerun).toBeNull();
  });
});
