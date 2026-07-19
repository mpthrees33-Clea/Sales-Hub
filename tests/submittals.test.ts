/**
 * WO-14 acceptance: composition schema round-trip; hero assembly (cover +
 * TOC page numbers matching real section starts + dividers + kind order +
 * "Page n of N" stamps, verified by read-back); missing-required-doc
 * escalation naming product + kind with no package produced; approve →
 * attachable asset + transmittal draft referencing it legally; routed
 * prepared-builder path with claim semantics.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db } from "@/db/client";
import { approvals, assets, pdsDocuments, submittalPackages, triageRoutings } from "@/db/schema";
import { runTriageForEmail } from "@/agents/email-triage";
import { executeApproval } from "@/lib/approvals/execute";
import { isAttachable } from "@/lib/assets";
import { getBlobBuffer } from "@/lib/blob";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import {
  assembleSubmittalPackage,
  proposeSubmittalComposition,
  runSubmittalFromRouting,
  SubmittalCompositionSchema,
} from "@/lib/submittals";
import { sid } from "@/db/seed/ids";
import { skuOf } from "@/db/seed/data/catalog";
import { DEMO_NOW } from "@/db/seed/scenario";
import { resetStagedBatch } from "./helpers/reset-staged";

const PROJECT_ID = sid("project:prj-harborview2");
const HERO_PRODUCTS = ["MS-WG-1147", skuOf("Matte White"), skuOf("Brushed Steel")].map((sku) => sid(`product:${sku}`));
const SUBMITTAL_EMAIL = sid("email:in-submittal-whitaker");

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  await resetStagedBatch();
});

async function pdfText(bytes: Uint8Array, pageNum: number): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({
    data: bytes.slice(),
    standardFontDataUrl: new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).pathname,
    verbosity: 0, // font-data warnings are irrelevant to text extraction
  }).promise;
  const page = await doc.getPage(pageNum);
  const tc = await page.getTextContent();
  await doc.destroy();
  return tc.items.map((i) => ("str" in i ? i.str : "")).join(" ");
}

describe("routed path — prepared builder session", () => {
  it("triage routes the Harborview request; the consumer prepares a draft, never auto-assembles", async () => {
    const { result } = await runTriageForEmail(SUBMITTAL_EMAIL, { trigger: "user" });
    expect(result.status).toBe("succeeded");
    const routing = await db.query.triageRoutings.findFirst({ where: eq(triageRoutings.emailId, SUBMITTAL_EMAIL) });
    expect(routing?.target).toBe("submittal");

    const res = await runSubmittalFromRouting(routing!.id, { trigger: "nightly" });
    expect(res?.status).toBe("prepared");
    expect(res?.runId).toBeNull();

    const draft = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.id, res!.packageId!) });
    expect(draft?.status).toBe("draft");
    expect(draft?.projectId).toBe(PROJECT_ID);
    expect(new Set(draft?.productIds)).toEqual(new Set(HERO_PRODUCTS));
    expect(draft?.sourceEmailId).toBe(SUBMITTAL_EMAIL);
    expect(draft?.outputBlobUrl).toBeNull(); // prepared, not assembled

    // Claim semantics: a second consumption attempt finds nothing pending.
    expect(await runSubmittalFromRouting(routing!.id, { trigger: "nightly" })).toBeNull();
    const after = await db.query.triageRoutings.findFirst({ where: eq(triageRoutings.id, routing!.id) });
    expect(after?.status).toBe("consumed");
  });
});

describe("hero flow — propose, assemble, approve", () => {
  let approvalId = "";
  let packageId = "";
  let assembledBytes: Uint8Array;

  it("the agent proposes a grounded composition and the composition schema round-trips", async () => {
    const draft = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.status, "draft") });
    expect(draft).toBeDefined();

    const res = await proposeSubmittalComposition({
      projectId: PROJECT_ID,
      productIds: draft!.productIds,
      sourceEmailId: SUBMITTAL_EMAIL,
      trigger: "user",
    });
    expect(res.status).toBe("proposed");
    if (res.status !== "proposed") return;
    approvalId = res.approvalId;

    const reparsed = SubmittalCompositionSchema.parse(JSON.parse(JSON.stringify(res.composition)));
    expect(reparsed.sections).toHaveLength(3);
    for (const s of reparsed.sections) {
      expect(s.docs.map((d) => d.kind)).toEqual(["pds", "install", "test_report", "warranty"]);
    }
    expect(reparsed.coverSheet.projectName).toBe("Harborview Medical Phase 2");
    expect(reparsed.coverSheet.gcName).toBe("Whitaker Commercial Contractors");
    // The email asked for samples — the note references the samples flow.
    expect(reparsed.sampleRequestNote).toMatch(/sample/i);

    // Approval lists every included doc as evidence.
    const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
    expect(approval?.kind).toBe("submittal");
    expect(approval?.riskTier).toBe("standard");
    const evidence = approval?.evidence ?? [];
    expect(evidence.filter((e) => e.type === "pdf_page")).toHaveLength(12); // 3 products × 4 docs
    expect(evidence.some((e) => e.quote === "pds for MS-WG-1147")).toBe(true);
    expect(evidence.some((e) => e.type === "email")).toBe(true);

    // Assemble the human-reviewed composition into the prepared draft row.
    const assembled = await assembleSubmittalPackage({
      approvalId,
      composition: res.composition,
      sourceEmailId: SUBMITTAL_EMAIL,
      packageId: draft!.id,
      actor: "system",
    });
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    packageId = assembled.packageId;
    expect(assembled.pageCount).toBe(16); // cover + 3 × (divider + 4 one-page docs)
    expect(packageId).toBe(draft!.id); // upgraded in place, no second row
    expect(await db.$count(submittalPackages)).toBe(1);

    const pkg = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.id, packageId) });
    expect(pkg?.status).toBe("pending_approval");
    expect(pkg?.submittalNumber).toMatch(/^SUB-/);
    expect(pkg?.sections?.map((s) => s.startPage)).toEqual([2, 7, 12]);
    assembledBytes = new Uint8Array(await getBlobBuffer(pkg!.outputBlobUrl!));
  }, 30_000);

  it("read-back: page count, TOC page numbers match section starts, stamps present", async () => {
    const doc = await PDFDocument.load(assembledBytes);
    expect(doc.getPageCount()).toBe(16);

    const cover = await pdfText(assembledBytes, 1);
    expect(cover).toContain("SUBMITTAL PACKAGE");
    expect(cover).toContain("Harborview Medical Phase 2");
    expect(cover).toContain("Whitaker Commercial Contractors");
    expect(cover).toContain("Cole Mercer");
    // TOC start pages printed on the cover match the actual section starts.
    expect(cover).toContain("page 2");
    expect(cover).toContain("page 7");
    expect(cover).toContain("page 12");
    expect(cover).toContain("Page 1 of 16");

    // Divider page for section 2 starts where the TOC says it does.
    const divider = await pdfText(assembledBytes, 7);
    expect(divider).toContain("SECTION 02");
    expect(divider).toContain("Page 7 of 16");

    const last = await pdfText(assembledBytes, 16);
    expect(last).toContain("Page 16 of 16");
  }, 30_000);

  it("approve registers the package as an attachable asset and queues the transmittal draft", async () => {
    const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
    const payload = approval!.proposedAction as Record<string, unknown>;
    expect(payload.submittalPackageId).toBe(packageId);
    expect((payload.transmittal as { to: string[] }).to).toEqual(["ray.delgado@whitakercommercial.example.com"]);

    const result = await executeApproval(approval!, payload, "submittal");
    expect(result.description).toContain("registered as attachable asset");
    expect(result.description).toContain("transmittal draft queued");

    const pkg = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.id, packageId) });
    expect(pkg?.status).toBe("approved");

    const asset = await db.query.assets.findFirst({ where: eq(assets.kind, "submittal") });
    expect(asset).toBeDefined();
    expect(await isAttachable(asset!.id)).toBe(true);

    // The second approval references the attachment legally (origin check).
    const drafts = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.kind, "email_draft"), eq(approvals.status, "pending")));
    const transmittal = drafts.find(
      (d) => (d.proposedAction as { intent?: string }).intent === "submittal_transmittal",
    );
    expect(transmittal).toBeDefined();
    const tp = transmittal!.proposedAction as { attachmentAssetIds: string[]; to: string[] };
    expect(tp.attachmentAssetIds).toEqual([asset!.id]);
    expect(await isAttachable(tp.attachmentAssetIds)).toBe(true);
  });
});

describe("grounded or it escalates", () => {
  it("a product missing a required doc escalates naming product + kind; no package is produced", async () => {
    const matteWhiteId = sid(`product:${skuOf("Matte White")}`);
    const installDoc = await db.query.pdsDocuments.findFirst({
      where: and(eq(pdsDocuments.productId, matteWhiteId), eq(pdsDocuments.kind, "install")),
    });
    expect(installDoc).toBeDefined();
    const saved = { ...installDoc! };
    await db.execute(sql`delete from pds_documents where id = ${saved.id}`);

    try {
      const packagesBefore = await db.$count(submittalPackages);
      const res = await proposeSubmittalComposition({
        projectId: PROJECT_ID,
        productIds: HERO_PRODUCTS,
        trigger: "user",
      });
      expect(res.status).toBe("escalated");
      if (res.status !== "escalated") return;
      expect(res.reason).toBe("missing_document");
      expect(res.detail.sku).toBe(skuOf("Matte White"));
      expect(res.detail.missingKind).toBe("install");
      expect(res.detail.resolutionOptions).toBeDefined();
      expect(await db.$count(submittalPackages)).toBe(packagesBefore);

      // The escalation lands in the approval queue for human resolution.
      const escalations = await db.select().from(approvals).where(eq(approvals.kind, "submittal"));
      const esc = escalations.find(
        (a) =>
          a.status === "pending" &&
          (a.proposedAction as { escalation?: { reason?: string } }).escalation?.reason === "missing_document",
      );
      expect(esc).toBeDefined();
    } finally {
      await db.insert(pdsDocuments).values(saved);
    }
  });
});
