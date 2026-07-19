/**
 * WO-10 acceptance: getAttachableAssets/isAttachable contract, slide-union
 * zod round-trip, PDF export page count + asset registration passing the
 * attachability check.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db } from "@/db/client";
import { pdsDocuments, presentations, products } from "@/db/schema";
import { getAttachableAssets, isAttachable, registerAsset } from "@/lib/assets";
import { composeSlides, exportPresentationPdf, SlideSchema } from "@/lib/presentations";
import { getBlobBuffer } from "@/lib/blob";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { sid } from "@/db/seed/ids";
import { DEMO_NOW } from "@/db/seed/scenario";

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  await db.execute(sql`delete from presentations`);
});

describe("asset-library contract", () => {
  it("getAttachableAssets covers marketing assets AND product documents", async () => {
    const all = await getAttachableAssets();
    expect(all.some((a) => a.source === "asset")).toBe(true);
    expect(all.some((a) => a.source === "pds_document")).toBe(true);
    const walnutDocs = await getAttachableAssets({ productId: sid("product:MS-WG-1147") });
    expect(walnutDocs.filter((a) => a.source === "pds_document")).toHaveLength(4);
  });

  it("isAttachable accepts library refs and rejects foreign ids", async () => {
    const doc = await db.query.pdsDocuments.findFirst({ where: eq(pdsDocuments.productId, sid("product:MS-WG-1147")) });
    expect(await isAttachable(doc!.id)).toBe(true);
    expect(await isAttachable([doc!.id, "22222222-2222-4222-8222-222222222222"])).toBe(false);
    expect(await isAttachable([])).toBe(true);
  });

  it("registerAsset audit-logs and the new asset is immediately attachable", async () => {
    const { assetId } = await registerAsset({
      kind: "case_study",
      title: "Test registration",
      blobUrl: "/api/blob/assets/asset-overview.pdf",
      contentType: "application/pdf",
      tags: ["test"],
      actor: "system",
    });
    expect(await isAttachable(assetId)).toBe(true);
    const { auditLog } = await import("@/db/schema");
    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, assetId));
    expect(rows.some((r) => r.action === "asset.registered")).toBe(true);
    await db.execute(sql`delete from assets where id = ${assetId}`);
  });
});

describe("presentations", () => {
  it("slide union round-trips through zod", async () => {
    const slides = await composeSlides("Test deck", [sid("product:MS-WG-1147")]);
    expect(slides[0]!.kind).toBe("title");
    expect(slides[slides.length - 1]!.kind).toBe("closing");
    for (const s of slides) {
      expect(() => SlideSchema.parse(JSON.parse(JSON.stringify(s)))).not.toThrow();
    }
  });

  it("a 3-product deck exports a 5-page PDF registered as an attachable asset", async () => {
    const three = await db.select({ id: products.id }).from(products).limit(3);
    const slides = await composeSlides("Export test deck", three.map((p) => p.id));
    const [pres] = await db
      .insert(presentations)
      .values({ title: "Export test deck", slides, status: "draft" })
      .returning({ id: presentations.id });

    const result = await exportPresentationPdf(pres!.id, "user:test");
    expect(result.pageCount).toBe(5); // title + 3 products + closing

    const bytes = await getBlobBuffer(result.blobUrl);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(5);
    expect(await isAttachable(result.assetId)).toBe(true);

    const updated = await db.query.presentations.findFirst({ where: eq(presentations.id, pres!.id) });
    expect(updated!.status).toBe("ready");
    expect(updated!.exportedAssetId).toBe(result.assetId);
  });
});
