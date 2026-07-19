/**
 * Presentation builder + PDF export (WO-10 tasks 5–6). Product slides are
 * auto-composed from the catalog; export renders fixed clean templates to a PDF
 * (pdf-lib) and registers it as an attachable `assets` row so it flows through
 * the standard attachment-origin check.
 */
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { presentations, products, roomScenes, type Slide } from "@/db/schema";
import { putBlob } from "@/lib/blob";
import { REP } from "@/lib/rep";
import { registerAsset } from "@/lib/assets";

export const SlideSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("title"), title: z.string(), subtitle: z.string() }),
  z.object({
    kind: z.literal("product"),
    productId: z.string(),
    sku: z.string(),
    name: z.string(),
    finish: z.string(),
    specLines: z.array(z.string()),
    swatchBlobUrl: z.string().optional(),
    sceneBlobUrl: z.string().optional(),
    talkingPoint: z.string().optional(),
  }),
  z.object({ kind: z.literal("closing"), repName: z.string(), repEmail: z.string(), repPhone: z.string(), company: z.string() }),
]);

/** Compose title + one product slide each + closing from a product set. */
export async function buildSlides(productIds: string[], title = "Product Selection"): Promise<Slide[]> {
  const prods = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
  const byId = new Map(prods.map((p) => [p.id, p]));
  const scenes = productIds.length ? await db.select().from(roomScenes).where(inArray(roomScenes.productId, productIds)) : [];
  const sceneByProduct = new Map(scenes.filter((s) => s.outputBlobUrl).map((s) => [s.productId, s.outputBlobUrl!]));

  const slides: Slide[] = [{ kind: "title", title, subtitle: `${REP.company} · Prepared by ${REP.name}` }];
  for (const id of productIds) {
    const p = byId.get(id);
    if (!p) continue;
    slides.push({
      kind: "product",
      productId: p.id,
      sku: p.sku,
      name: p.name,
      finish: p.finish,
      specLines: [`Fire rating: ${p.spec.fireRating}`, `Thickness: ${p.spec.thicknessMm} mm`, `Width: ${p.spec.widthMm} mm`, `Adhesive: ${p.spec.adhesive}`],
      swatchBlobUrl: p.swatchBlobUrl ?? undefined,
      sceneBlobUrl: sceneByProduct.get(p.id),
      talkingPoint: `${p.name} — ${p.finish} finish, ${p.family}.`,
    });
  }
  slides.push({ kind: "closing", repName: REP.name, repEmail: REP.email, repPhone: REP.phone, company: REP.company });
  return slides;
}

export async function createPresentation(title: string, productIds: string[]): Promise<{ id: string; slides: number }> {
  const slides = await buildSlides(productIds, title);
  const [row] = await db.insert(presentations).values({ title, slides, status: "ready" }).returning({ id: presentations.id });
  return { id: row!.id, slides: slides.length };
}

/** Render a presentation's slides to a PDF, store it, and register it as an attachable asset. */
export async function exportPresentationPdf(presentationId: string): Promise<{ assetId: string; blobUrl: string; pages: number }> {
  const pres = await db.query.presentations.findFirst({ where: eq(presentations.id, presentationId) });
  if (!pres) throw new Error(`presentation ${presentationId} not found`);
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const INK = rgb(0.13, 0.13, 0.15);
  const MUTED = rgb(0.45, 0.45, 0.5);

  for (const slide of pres.slides) {
    const page = doc.addPage([792, 612]);
    page.drawText(REP.company.toUpperCase(), { x: 54, y: 560, size: 9, font, color: MUTED });
    if (slide.kind === "title") {
      page.drawText(slide.title, { x: 54, y: 340, size: 36, font: bold, color: INK });
      page.drawText(slide.subtitle, { x: 54, y: 300, size: 13, font, color: MUTED });
    } else if (slide.kind === "product") {
      page.drawText(slide.name, { x: 54, y: 500, size: 28, font: bold, color: INK });
      page.drawText(slide.sku, { x: 54, y: 476, size: 12, font, color: MUTED });
      slide.specLines.forEach((l, i) => page.drawText(l, { x: 54, y: 430 - i * 22, size: 12, font, color: INK }));
      if (slide.talkingPoint) page.drawText(slide.talkingPoint, { x: 54, y: 90, size: 11, font, color: MUTED });
    } else {
      page.drawText("Let's build it.", { x: 54, y: 400, size: 30, font: bold, color: INK });
      page.drawText(`${slide.repName} · ${slide.repEmail}`, { x: 54, y: 360, size: 13, font, color: INK });
      page.drawText(slide.repPhone, { x: 54, y: 338, size: 12, font, color: MUTED });
    }
  }

  const bytes = await doc.save();
  const key = `assets/presentation-${presentationId}.pdf`;
  const blobUrl = await putBlob(key, Buffer.from(bytes), { contentType: "application/pdf" });
  const assetId = await registerAsset({ kind: "presentation", title: pres.title, blobUrl, contentType: "application/pdf", tags: ["presentation"] });
  await db.update(presentations).set({ exportedAssetId: assetId }).where(eq(presentations.id, presentationId));
  return { assetId, blobUrl, pages: pres.slides.length };
}
