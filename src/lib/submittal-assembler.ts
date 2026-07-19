/**
 * Deterministic submittal assembler (WO-14 task 3) — NO LLM anywhere in this
 * file. Input is a validated composition with resolved document blobs; output
 * is the merged package: generated cover sheet with TOC, a divider page per
 * product, docs concatenated in kind order, and "Page n of N" stamped
 * bottom-right on every page. Page numbers and ordering are code.
 */
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { getBlobBuffer } from "@/lib/blob";

const LETTER: [number, number] = [612, 792];
const INK = rgb(0.13, 0.13, 0.15);
const MUTED = rgb(0.45, 0.45, 0.5);
const LINE = rgb(0.8, 0.8, 0.83);
const ACCENT = rgb(0.72, 0.38, 0.16);

export type AssembleSection = {
  sku: string;
  productName: string;
  note?: string;
  /** Already in kind order (pds, install, test_report, warranty). */
  docs: { kind: string; title: string; blobUrl: string }[];
};

export type AssembleInput = {
  coverSheet: {
    packageTitle: string;
    submittalNumber: string;
    projectName: string;
    projectAddress: string;
    gcName: string;
    architectName: string;
    repName: string;
    repContact: string;
    date: string;
  };
  sections: AssembleSection[];
};

export type AssembleResult = {
  bytes: Uint8Array;
  pageCount: number;
  toc: { sku: string; productName: string; startPage: number; docCount: number }[];
};

export async function assembleSubmittalPdf(input: AssembleInput): Promise<AssembleResult> {
  // Pass 1 — load every source doc and count pages so the cover's TOC prints
  // real start pages before any page is appended.
  const loaded: { section: AssembleSection; docs: { doc: PDFDocument; title: string; kind: string }[] }[] = [];
  for (const section of input.sections) {
    const docs: { doc: PDFDocument; title: string; kind: string }[] = [];
    for (const d of section.docs) {
      const bytes = await getBlobBuffer(d.blobUrl);
      docs.push({ doc: await PDFDocument.load(new Uint8Array(bytes)), title: d.title, kind: d.kind });
    }
    loaded.push({ section, docs });
  }

  const toc: AssembleResult["toc"] = [];
  let cursor = 2; // page 1 is the cover
  for (const { section, docs } of loaded) {
    toc.push({ sku: section.sku, productName: section.productName, startPage: cursor, docCount: docs.length });
    cursor += 1 + docs.reduce((a, d) => a + d.doc.getPageCount(), 0); // divider + doc pages
  }
  const pageCount = cursor - 1;

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const mono = await out.embedFont(StandardFonts.Courier);

  drawCover(out.addPage(LETTER), { font, bold, mono }, input, toc);

  for (const [i, { section, docs }] of loaded.entries()) {
    drawDivider(out.addPage(LETTER), { font, bold, mono }, section, i + 1);
    for (const d of docs) {
      const pages = await out.copyPages(d.doc, d.doc.getPageIndices());
      for (const p of pages) out.addPage(p);
    }
  }

  // Global "Page n of N" stamps, bottom-right, every page including the cover.
  const pages = out.getPages();
  for (const [i, page] of pages.entries()) {
    const label = `Page ${i + 1} of ${pages.length}`;
    const w = mono.widthOfTextAtSize(label, 8);
    page.drawText(label, { x: page.getWidth() - 40 - w, y: 24, size: 8, font: mono, color: MUTED });
  }

  return { bytes: await out.save(), pageCount, toc };
}

type Fonts = { font: PDFFont; bold: PDFFont; mono: PDFFont };

function drawCover(page: PDFPage, f: Fonts, input: AssembleInput, toc: AssembleResult["toc"]) {
  const { coverSheet: c } = input;
  const left = 54;
  page.drawText("SUBMITTAL PACKAGE", { x: left, y: 726, size: 10, font: f.mono, color: ACCENT });
  page.drawText(c.packageTitle, { x: left, y: 694, size: 19, font: f.bold, color: INK, maxWidth: 504 });
  page.drawText(`${c.submittalNumber}  ·  ${c.date}`, { x: left, y: 672, size: 10, font: f.mono, color: MUTED });
  page.drawLine({ start: { x: left, y: 654 }, end: { x: 558, y: 654 }, thickness: 0.75, color: LINE });

  const rows: [string, string][] = [
    ["Project", c.projectName],
    ["Address", c.projectAddress],
    ["General contractor", c.gcName],
    ["Architect", c.architectName],
    ["Prepared by", c.repName],
    ["Contact", c.repContact],
  ];
  let y = 626;
  for (const [k, v] of rows) {
    page.drawText(k.toUpperCase(), { x: left, y, size: 7.5, font: f.mono, color: MUTED });
    page.drawText(v || "—", { x: left + 150, y, size: 10.5, font: f.font, color: INK, maxWidth: 350 });
    y -= 22;
  }

  page.drawText("CONTENTS", { x: left, y: y - 16, size: 8, font: f.mono, color: ACCENT });
  y -= 40;
  for (const [i, t] of toc.entries()) {
    page.drawText(String(i + 1).padStart(2, "0"), { x: left, y, size: 10, font: f.mono, color: MUTED });
    page.drawText(`${t.productName} (${t.sku})`, { x: left + 30, y, size: 11, font: f.bold, color: INK });
    page.drawText(`${t.docCount} documents`, { x: left + 320, y, size: 9, font: f.font, color: MUTED });
    page.drawText(`page ${t.startPage}`, { x: 500, y, size: 10, font: f.mono, color: INK });
    y -= 24;
  }

  page.drawLine({ start: { x: left, y: 72 }, end: { x: 558, y: 72 }, thickness: 0.75, color: LINE });
  page.drawText("Assembled by Clea for Meridian Surfaces Co. — drafts only; humans send.", {
    x: left,
    y: 56,
    size: 8,
    font: f.font,
    color: MUTED,
  });
}

function drawDivider(page: PDFPage, f: Fonts, section: AssembleSection, n: number) {
  const left = 54;
  page.drawText(`SECTION ${String(n).padStart(2, "0")}`, { x: left, y: 620, size: 10, font: f.mono, color: ACCENT });
  page.drawText(section.productName, { x: left, y: 584, size: 24, font: f.bold, color: INK, maxWidth: 504 });
  page.drawText(section.sku, { x: left, y: 560, size: 12, font: f.mono, color: MUTED });
  page.drawLine({ start: { x: left, y: 540 }, end: { x: 558, y: 540 }, thickness: 0.75, color: LINE });

  let y = 512;
  for (const d of section.docs) {
    page.drawText("·", { x: left, y, size: 11, font: f.bold, color: ACCENT });
    page.drawText(d.title, { x: left + 14, y, size: 10.5, font: f.font, color: INK });
    y -= 20;
  }
  if (section.note) {
    page.drawText(section.note, { x: left, y: y - 12, size: 9.5, font: f.font, color: MUTED, maxWidth: 460 });
  }
}
