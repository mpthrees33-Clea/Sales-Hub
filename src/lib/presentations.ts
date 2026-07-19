/**
 * Presentation composition + PDF export (WO-10 tasks 5–6). Slides are a
 * typed union stored as jsonb; export renders fixed clean templates via
 * pdf-lib and registers the PDF as a library asset — making it
 * email-attachable through the standard origin check.
 */
import { PDFDocument, PDFFont, rgb, StandardFonts } from "pdf-lib";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { presentations, products, roomScenes, type Slide } from "@/db/schema";
import { putBlob } from "@/lib/blob";
import { REP } from "@/lib/rep";
import { registerAsset } from "@/lib/assets";

export const SlideSchema: z.ZodType<Slide> = z.union([
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

/** Auto-compose title + per-product + closing slides for the picked products. */
export async function composeSlides(title: string, productIds: string[]): Promise<Slide[]> {
  const rows = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const scenes = productIds.length
    ? await db.select().from(roomScenes).where(inArray(roomScenes.productId, productIds))
    : [];
  const sceneByProduct = new Map(scenes.filter((s) => s.outputBlobUrl).map((s) => [s.productId, s.outputBlobUrl!]));

  const productSlides: Slide[] = productIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      kind: "product" as const,
      productId: p.id,
      sku: p.sku,
      name: p.name,
      finish: p.finish,
      specLines: [
        `Fire rating: ${p.spec.fireRating}`,
        `Thickness ${p.spec.thicknessMm} mm · width ${p.spec.widthMm} mm`,
        `Adhesive: ${p.spec.adhesive}`,
      ],
      swatchBlobUrl: p.swatchBlobUrl ?? undefined,
      sceneBlobUrl: sceneByProduct.get(p.id),
    }));

  return [
    { kind: "title", title, subtitle: `${REP.company} · prepared by ${REP.name}` },
    ...productSlides,
    { kind: "closing", repName: REP.name, repEmail: REP.email, repPhone: REP.phone, company: REP.company },
  ];
}

/** Render slides to a PDF, store to Blob, register as an attachable asset. */
export async function exportPresentationPdf(presentationId: string, actor: `user:${string}`): Promise<{
  assetId: string;
  blobUrl: string;
  pageCount: number;
}> {
  const pres = await db.query.presentations.findFirst({ where: eq(presentations.id, presentationId) });
  if (!pres) throw new Error("presentation not found");

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const SIZE: [number, number] = [792, 612]; // landscape letter
  const INK = rgb(0.12, 0.12, 0.14);
  const MUTED = rgb(0.45, 0.45, 0.5);

  for (const slide of pres.slides) {
    const page = doc.addPage(SIZE);
    page.drawRectangle({ x: 0, y: 0, width: SIZE[0], height: SIZE[1], color: rgb(0.97, 0.97, 0.965) });
    page.drawText("MERIDIAN SURFACES CO.", { x: 48, y: 570, size: 9, font: mono, color: MUTED });
    if (slide.kind === "title") {
      page.drawText(slide.title, { x: 48, y: 330, size: 34, font: bold, color: INK });
      page.drawText(slide.subtitle, { x: 48, y: 296, size: 13, font, color: MUTED });
    } else if (slide.kind === "product") {
      page.drawText(slide.name, { x: 48, y: 520, size: 26, font: bold, color: INK });
      page.drawText(`${slide.sku} · ${slide.finish}`, { x: 48, y: 494, size: 12, font: mono, color: MUTED });
      let y = 440;
      for (const line of slide.specLines) {
        page.drawText(`· ${line}`, { x: 48, y, size: 12, font, color: INK });
        y -= 22;
      }
      if (slide.talkingPoint) {
        page.drawText(`"${slide.talkingPoint}"`, { x: 48, y: y - 16, size: 11, font, color: MUTED });
      }
      // Swatch block (solid color band standing in for the raster swatch).
      page.drawRectangle({ x: 470, y: 180, width: 270, height: 330, color: rgb(0.82, 0.78, 0.72) });
      page.drawText("swatch", { x: 480, y: 190, size: 8, font: mono, color: rgb(0.35, 0.32, 0.3) });
      drawFooter(page, font);
    } else {
      page.drawText("Let's put it on a wall.", { x: 48, y: 380, size: 26, font: bold, color: INK });
      page.drawText(slide.repName, { x: 48, y: 330, size: 14, font: bold, color: INK });
      page.drawText(`${slide.company}`, { x: 48, y: 312, size: 11, font, color: MUTED });
      page.drawText(`${slide.repEmail} · ${slide.repPhone}`, { x: 48, y: 294, size: 11, font: mono, color: MUTED });
      drawFooter(page, font);
    }
  }

  function drawFooter(page: ReturnType<typeof doc.addPage>, f: PDFFont) {
    page.drawText("Fictional demo collateral — Clea Sales Hub", { x: 48, y: 28, size: 7.5, font: f, color: MUTED });
  }

  const bytes = await doc.save();
  const key = `presentations/${presentationId}.pdf`;
  const blobUrl = await putBlob(key, Buffer.from(bytes), { contentType: "application/pdf" });
  const { assetId } = await registerAsset({
    kind: "presentation",
    title: `${pres.title} (deck)`,
    blobUrl,
    contentType: "application/pdf",
    tags: ["presentation", "export"],
    productIds: pres.slides.filter((s): s is Extract<Slide, { kind: "product" }> => s.kind === "product").map((s) => s.productId),
    actor,
  });
  await db
    .update(presentations)
    .set({ status: "ready", exportedAssetId: assetId })
    .where(eq(presentations.id, presentationId));
  return { assetId, blobUrl, pageCount: pres.slides.length };
}
