/**
 * WO-14: the submittal agent proposes composition; the assembler deterministically
 * merges the real PDFs (cover+TOC, per-product divider + docs, page stamps). A
 * product missing a required doc escalates. Approving registers the package as an
 * attachable asset.
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, assets, pdsDocuments, submittalPackages } from "@/db/schema";
import { submittalAgent } from "@/agents/submittal";
import { assembleSubmittalPdf } from "@/lib/submittal-assembler";
import { CompositionSchema, missingRequiredKinds, orderDocs, type Composition } from "@/lib/submittals";
import { isAttachable } from "@/lib/assets";
import { resolveApprovalCore } from "@/lib/approvals/resolve";
import { REP } from "@/lib/rep";
import { sid } from "@/db/seed/ids";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

const HARBORVIEW = () => sid("project:prj-harborview2");
const HERO_SKUS = ["MS-WG-1147", "MS-MT-1400", "MS-ST-1195"];

async function compositionFor(skus: string[]): Promise<Composition> {
  const sections: Composition["sections"] = [];
  for (const sku of skus) {
    const productId = sid(`product:${sku}`);
    const docs = await db.select({ id: pdsDocuments.id, kind: pdsDocuments.kind, title: pdsDocuments.title }).from(pdsDocuments).where(eq(pdsDocuments.productId, productId));
    sections.push({ productId, sku, productName: sku, docs: orderDocs(docs.map((d) => ({ pdsDocumentId: d.id, kind: d.kind, title: d.title }))) });
  }
  return {
    coverSheet: { projectName: "Harborview Medical Phase 2", projectAddress: "2401 Caldwell St, Charlotte, NC", gcName: "Whitaker", architectName: "Calder", repName: REP.name, repContact: REP.email, date: "March 10, 2026", packageTitle: "Harborview Ph2 — Submittal", submittalNumber: "SUB-20260310-01" },
    sections,
  };
}

describe("composition contract", () => {
  it("round-trips through Zod", async () => {
    const c = await compositionFor(HERO_SKUS);
    expect(CompositionSchema.safeParse(c).success).toBe(true);
  });
  it("flags missing required kinds", () => {
    expect(missingRequiredKinds(["pds", "install", "warranty"])).toEqual([]);
    expect(missingRequiredKinds(["pds"])).toEqual(["install"]);
  });
});

describe("assembler", () => {
  it("merges 3 products with cover+TOC, dividers, docs, and Page n of N stamps", async () => {
    const c = await compositionFor(HERO_SKUS);
    const key = "submittals/test-hero.pdf";
    const out = await assembleSubmittalPdf(c, key);

    // cover(1) + per section (divider 1 + docs) ; each seeded doc is 1 page.
    const docCount = c.sections.reduce((a, s) => a + s.docs.length, 0);
    const expected = 1 + c.sections.length * 1 + docCount;
    expect(out.pages).toBe(expected);

    // TOC start pages match the actual divider page numbers: section i divider is
    // at 2 + sum(prev sections' (1 + docs)).
    let running = 2;
    for (let i = 0; i < c.sections.length; i++) {
      expect(out.sections[i]!.startPage).toBe(running);
      running += 1 + c.sections[i]!.docs.length;
    }

    // Read the bytes back with pdf-lib and confirm the page count.
    const { getBlobBuffer } = await import("@/lib/blob");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await getBlobBuffer(out.blobUrl));
    expect(doc.getPageCount()).toBe(expected);
  }, 20_000);
});

describe("submittal agent", () => {
  it("assembles the hero package, files a submittal approval, and approving registers an attachable asset", async () => {
    const run = await submittalAgent.run({ projectId: HARBORVIEW(), productIds: HERO_SKUS.map((s) => sid(`product:${s}`)) }, { trigger: "user" });
    expect(run.status).toBe("succeeded");
    expect(run.approvalIds.length).toBe(1);

    const appr = await db.query.approvals.findFirst({ where: eq(approvals.id, run.approvalIds[0]!) });
    expect(appr?.kind).toBe("submittal");
    // one pdf_page evidence item per included document
    expect(appr!.evidence.filter((e) => e.type === "pdf_page").length).toBeGreaterThanOrEqual(HERO_SKUS.length * 2);
    const pa = appr!.proposedAction as { submittalPackageId?: string; outputBlobUrl?: string };
    expect(pa.submittalPackageId).toBeTruthy();

    const pkg = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.id, pa.submittalPackageId!) });
    expect(pkg?.status).toBe("pending_approval");

    const res = await resolveApprovalCore({ id: run.approvalIds[0]!, resolution: "approve" }, REP.id);
    expect(res.outcome).toBe("approved");

    const pkgRows = await db.select().from(submittalPackages).where(eq(submittalPackages.id, pa.submittalPackageId!));
    expect(pkgRows[0]!.status).toBe("approved");
    // The assembled PDF is now a registered, attachable asset (origin check passes).
    const assetRows = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.kind, "submittal"), eq(assets.blobUrl, pa.outputBlobUrl!)));
    expect(assetRows.length).toBe(1);
    expect(await isAttachable(assetRows[0]!.id)).toBe(true);
  }, 30_000);

  it("escalates when a product is missing a required document (no package assembled)", async () => {
    // Drop the install guide for a scratch product's docs to force a gap.
    const sku = "MS-MT-1261";
    const productId = sid(`product:${sku}`);
    await db.delete(pdsDocuments).where(eq(pdsDocuments.id, sid(`pds:${sku}:install`)));
    const before = await db.$count(submittalPackages);
    const run = await submittalAgent.run({ projectId: HARBORVIEW(), productIds: [productId] }, { trigger: "user" });
    expect(run.status).toBe("escalated");
    expect(run.escalation?.reason).toBe("missing_document");
    expect((run.escalation!.detail as { missing?: string[] }).missing).toContain("install");
    expect(await db.$count(submittalPackages)).toBe(before);
  }, 20_000);
});
