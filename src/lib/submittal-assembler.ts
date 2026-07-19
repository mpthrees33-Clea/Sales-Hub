/**
 * Deterministic submittal assembler (WO-14 task 3). NO LLM: given a validated
 * composition, it merges the real PDFs (cover + table of contents, then per
 * product a divider page followed by that product's docs in kind order) and
 * stamps global "Page n of N" numbers. Page numbers, ordering, and the TOC
 * start pages are arithmetic — the output is byte-stable for a given input.
 */
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { pdsDocuments, type SubmittalSection } from "@/db/schema";
import { getBlobBuffer, putBlob } from "@/lib/blob";
import { REP } from "@/lib/rep";
import { type Composition, orderDocs } from "@/lib/submittals";

export type AssembledSubmittal = { blobUrl: string; pages: number; sections: SubmittalSection[] };

const PAGE_W = 612; // US Letter portrait
const PAGE_H = 792;
const MARGIN = 56;

export async function assembleSubmittalPdf(composition: Composition, key: string): Promise<AssembledSubmittal> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const bold = await merged.embedFont(StandardFonts.HelveticaBold);
  const INK = rgb(0.13, 0.13, 0.15);
  const MUTED = rgb(0.42, 0.42, 0.48);
  const LINE = rgb(0.82, 0.82, 0.85);

  // 1. Resolve blob URLs from the DB (never trust a composition-carried URL),
  //    then pre-load every doc so we know page counts before writing the TOC.
  const docIds = [...new Set(composition.sections.flatMap((s) => s.docs.map((d) => d.pdsDocumentId)))];
  const docRows = docIds.length ? await db.select({ id: pdsDocuments.id, blobUrl: pdsDocuments.blobUrl }).from(pdsDocuments).where(inArray(pdsDocuments.id, docIds)) : [];
  const blobById = new Map(docRows.map((r) => [r.id, r.blobUrl]));
  const loaded = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();
  const pageCount = new Map<string, number>();
  for (const id of docIds) {
    const blobUrl = blobById.get(id);
    if (!blobUrl) throw new Error(`submittal assembly: document ${id} not found`);
    const src = await PDFDocument.load(await getBlobBuffer(blobUrl));
    loaded.set(id, src);
    pageCount.set(id, src.getPageCount());
  }

  // 2. Layout: page 1 is the cover+TOC; each section = 1 divider + its doc pages.
  const outSections: SubmittalSection[] = [];
  let running = 2; // first section divider lands on page 2
  for (const section of composition.sections) {
    const docs = orderDocs(section.docs);
    const docPages = docs.reduce((a, d) => a + (pageCount.get(d.pdsDocumentId) ?? 0), 0);
    outSections.push({
      productId: section.productId,
      sku: section.sku,
      productName: section.productName,
      docs: docs.map((d) => ({ pdsDocumentId: d.pdsDocumentId, kind: d.kind, title: d.title })),
      note: section.note,
      startPage: running,
    });
    running += 1 + docPages;
  }

  // 3. Cover + table of contents.
  const cover = merged.addPage([PAGE_W, PAGE_H]);
  const cs = composition.coverSheet;
  cover.drawText(REP.company.toUpperCase(), { x: MARGIN, y: PAGE_H - MARGIN, size: 10, font, color: MUTED });
  cover.drawText("SUBMITTAL PACKAGE", { x: MARGIN, y: PAGE_H - MARGIN - 40, size: 12, font: bold, color: MUTED });
  cover.drawText(cs.packageTitle, { x: MARGIN, y: PAGE_H - MARGIN - 74, size: 24, font: bold, color: INK });
  cover.drawText(cs.projectName, { x: MARGIN, y: PAGE_H - MARGIN - 100, size: 13, font, color: INK });
  cover.drawText(cs.projectAddress, { x: MARGIN, y: PAGE_H - MARGIN - 118, size: 10, font, color: MUTED });

  const meta: [string, string][] = [
    ["Submittal No.", cs.submittalNumber],
    ["Date", cs.date],
    ["General Contractor", cs.gcName],
    ["Architect", cs.architectName],
    ["Prepared by", `${cs.repName} · ${cs.repContact}`],
  ];
  let my = PAGE_H - MARGIN - 160;
  for (const [k, v] of meta) {
    cover.drawText(k, { x: MARGIN, y: my, size: 9, font, color: MUTED });
    cover.drawText(v, { x: MARGIN + 130, y: my, size: 10, font: bold, color: INK });
    my -= 20;
  }

  my -= 16;
  cover.drawText("CONTENTS", { x: MARGIN, y: my, size: 11, font: bold, color: MUTED });
  my -= 8;
  cover.drawLine({ start: { x: MARGIN, y: my }, end: { x: PAGE_W - MARGIN, y: my }, thickness: 0.5, color: LINE });
  my -= 20;
  outSections.forEach((s, i) => {
    const label = `${String(i + 1).padStart(2, "0")}  ${s.productName}  (${s.sku})`;
    cover.drawText(label, { x: MARGIN, y: my, size: 10, font, color: INK });
    cover.drawText(String(s.startPage), { x: PAGE_W - MARGIN - 24, y: my, size: 10, font, color: MUTED });
    my -= 18;
  });
  if (composition.sampleRequestNote) {
    my -= 10;
    cover.drawText(`Note: ${composition.sampleRequestNote}`, { x: MARGIN, y: my, size: 9, font, color: MUTED });
  }

  // 4. Per-section divider + concatenated docs.
  for (let i = 0; i < composition.sections.length; i++) {
    const section = composition.sections[i]!;
    const docs = orderDocs(section.docs);
    const divider = merged.addPage([PAGE_W, PAGE_H]);
    divider.drawText(`SECTION ${String(i + 1).padStart(2, "0")}`, { x: MARGIN, y: PAGE_H / 2 + 30, size: 12, font, color: MUTED });
    divider.drawText(section.productName, { x: MARGIN, y: PAGE_H / 2, size: 26, font: bold, color: INK });
    divider.drawText(section.sku, { x: MARGIN, y: PAGE_H / 2 - 24, size: 12, font, color: MUTED });
    divider.drawText(docs.map((d) => d.kind).join(" · "), { x: MARGIN, y: PAGE_H / 2 - 48, size: 10, font, color: MUTED });
    if (section.note) divider.drawText(section.note, { x: MARGIN, y: PAGE_H / 2 - 72, size: 10, font, color: MUTED });

    for (const doc of docs) {
      const src = loaded.get(doc.pdsDocumentId)!;
      const copied = await merged.copyPages(src, src.getPageIndices());
      copied.forEach((pg) => merged.addPage(pg));
    }
  }

  // 5. Global page stamps.
  const pages = merged.getPages();
  const N = pages.length;
  pages.forEach((page, i) => {
    page.drawText(`Page ${i + 1} of ${N}`, { x: PAGE_W - MARGIN - 66, y: 28, size: 8, font, color: MUTED });
  });

  const bytes = await merged.save();
  const blobUrl = await putBlob(key, Buffer.from(bytes), { contentType: "application/pdf" });
  return { blobUrl, pages: N, sections: outSections };
}
