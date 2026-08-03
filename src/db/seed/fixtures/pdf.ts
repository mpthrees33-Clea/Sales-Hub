/**
 * pdf-lib fixture generators (docs/04 §4): per-SKU product documents (PDS,
 * install, test report, warranty) and the two staged PO PDFs. The PO
 * generator records real draw positions and emits the matching grounded
 * extraction JSON (page + bbox fractions, top-left origin) — so the demo
 * model's "extraction" and the split-view highlights are honest against the
 * actual PDF layout.
 */
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { CatalogEntry } from "../data/catalog";
import type { ScenarioLine } from "../data/commerce";
import { formatCentsExact } from "@/lib/money";

const LETTER: [number, number] = [612, 792];
const INK = rgb(0.13, 0.13, 0.15);
const MUTED = rgb(0.45, 0.45, 0.5);
const LINE = rgb(0.8, 0.8, 0.83);

type Anchor = { page: number; bbox?: [number, number, number, number] };

/** bbox fractions with top-left origin, from pdf-lib bottom-left coords. */
function fbox(x: number, yTopOfText: number, w: number, h: number): [number, number, number, number] {
  const [W, H] = LETTER;
  return [
    round4(x / W),
    round4((H - yTopOfText - h) / H),
    round4((x + w) / W),
    round4((H - yTopOfText) / H),
  ];
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// ── Product documents ────────────────────────────────────────────────────────

export async function makeProductDocPdf(
  entry: CatalogEntry,
  kind: "pds" | "install" | "test_report" | "warranty",
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const titles: Record<typeof kind, string> = {
    pds: "PRODUCT DATA SHEET",
    install: "INSTALLATION GUIDE",
    test_report: "SURFACE BURNING TEST REPORT",
    warranty: "LIMITED WARRANTY",
  };

  const page = doc.addPage(LETTER);
  header(page, bold, mono, titles[kind], entry);

  let y = 640;
  const specRows: [string, string][] = [
    ["Product", `${entry.name} (${entry.sku})`],
    ["Family / Finish", `${entry.family} — ${entry.finish}`],
    ["Thickness", "0.30 mm nominal"],
    ["Width", "1220 mm (48 in)"],
    ["Roll length", "50 m (164 ft)"],
    ["Fire rating", entry.fireRating],
    ["Adhesive", "Acrylic, pressure-sensitive, air-egress liner"],
    ["Substrates", "Drywall, metal, MDF, existing laminate (primed)"],
  ];

  if (kind === "pds") {
    y = sectionTitle(page, bold, "1. Technical data", y);
    y = table(page, font, specRows, y);
    y = sectionTitle(page, bold, "2. Applications", y - 10);
    y = para(
      page,
      font,
      "Interior vertical surfaces, casework fronts, column wraps, door and frame refinishing. Suitable for healthcare, hospitality, office TI, education, and retail environments subject to the limitations in section 3.",
      y,
    );
    y = sectionTitle(page, bold, "3. Limitations", y - 10);
    para(
      page,
      font,
      "Not for exterior use, floors, or countertop work surfaces. Substrate must be smooth, sound, dry, and primed per the installation guide. Radius minimum 5 mm without heat; 1 mm with heat assist.",
      y,
    );
  } else if (kind === "install") {
    y = sectionTitle(page, bold, "1. Substrate preparation", y);
    y = para(
      page,
      font,
      "Surfaces must be clean, dry, smooth, and cured. Sand gloss surfaces to a uniform matte, remove dust with a tack cloth, and apply the recommended primer. Ambient temperature 15–35 C during application and for 48 hours after.",
      y,
    );
    y = sectionTitle(page, bold, "2. Application", y - 10);
    y = para(
      page,
      font,
      "Dry-apply using a felt-edge squeegee with 50% overlap strokes from the center outward. Use the air-egress liner channels to eliminate trapped air. For inside corners and radii, warm the film to 40–60 C and post-heat set edges to 90 C.",
      y,
    );
    y = sectionTitle(page, bold, "3. Seams and finishing", y - 10);
    para(
      page,
      font,
      "Overlap seams 2 mm and trim double-cut for a butt seam appearance. Roll all edges with a hard rubber roller. Do not wet-clean for 72 hours after installation.",
      y,
    );
  } else if (kind === "test_report") {
    y = sectionTitle(page, bold, "1. Test summary — ASTM E84 (25 ft tunnel)", y);
    y = table(
      page,
      font,
      [
        ["Specimen", `${entry.name} (${entry.sku}) on 5/8 in gypsum`],
        ["Flame spread index", entry.fireRating.startsWith("Class A") ? "20" : "55"],
        ["Smoke developed index", entry.fireRating.startsWith("Class A") ? "180" : "320"],
        ["Classification", entry.fireRating],
        ["Laboratory", "Meridian Fire Sciences Lab, Charlotte NC (fictional)"],
        ["Report no.", `MFS-${entry.sku.replace(/[^0-9]/g, "")}-E84`],
      ],
      y,
    );
    para(
      page,
      font,
      "This report applies to the referenced product as manufactured at the date of testing. Results relate only to the specimen tested. Demo document — fictional laboratory and data for demonstration purposes.",
      y - 12,
    );
  } else {
    y = sectionTitle(page, bold, "1. Coverage", y);
    y = para(
      page,
      font,
      `Meridian Surfaces Co. warrants ${entry.name} (${entry.sku}) against delamination, cracking, and colorfastness failure for a period of ten (10) years from installation on interior vertical surfaces when installed per the installation guide by a qualified installer.`,
      y,
    );
    y = sectionTitle(page, bold, "2. Exclusions", y - 10);
    para(
      page,
      font,
      "Damage from impact, abrasion, chemical exposure outside the cleaning guide, substrate failure, or installation outside published parameters is excluded. Remedy is limited to replacement material.",
      y,
    );
  }

  footer(page, font, `${entry.sku} · ${titles[kind]} · Meridian Surfaces Co. — fictional demo document`);
  return doc.save();
}

function header(page: PDFPage, bold: PDFFont, mono: PDFFont, title: string, entry: CatalogEntry) {
  page.drawText("MERIDIAN SURFACES CO.", { x: 54, y: 744, size: 9, font: mono, color: MUTED });
  page.drawText(title, { x: 54, y: 714, size: 18, font: bold, color: INK });
  page.drawText(`${entry.name}  ·  ${entry.sku}`, { x: 54, y: 692, size: 11, font: bold, color: INK });
  page.drawLine({ start: { x: 54, y: 678 }, end: { x: 558, y: 678 }, thickness: 0.75, color: LINE });
}

function sectionTitle(page: PDFPage, bold: PDFFont, text: string, y: number): number {
  page.drawText(text, { x: 54, y, size: 11, font: bold, color: INK });
  return y - 18;
}

function para(page: PDFPage, font: PDFFont, text: string, y: number): number {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    if (font.widthOfTextAtSize(line + " " + w, 9.5) > 500) {
      page.drawText(line.trim(), { x: 54, y: yy, size: 9.5, font, color: INK });
      yy -= 13;
      line = w;
    } else {
      line = line + " " + w;
    }
  }
  if (line.trim()) {
    page.drawText(line.trim(), { x: 54, y: yy, size: 9.5, font, color: INK });
    yy -= 13;
  }
  return yy - 4;
}

function table(page: PDFPage, font: PDFFont, rows: [string, string][], y: number): number {
  let yy = y;
  for (const [k, v] of rows) {
    page.drawText(k, { x: 54, y: yy, size: 9, font, color: MUTED });
    page.drawText(v, { x: 210, y: yy, size: 9.5, font, color: INK });
    page.drawLine({ start: { x: 54, y: yy - 5 }, end: { x: 558, y: yy - 5 }, thickness: 0.4, color: LINE });
    yy -= 17;
  }
  return yy;
}

function footer(page: PDFPage, font: PDFFont, text: string) {
  page.drawText(text, { x: 54, y: 40, size: 7.5, font, color: MUTED });
}

// ── PO PDFs with grounded extraction ─────────────────────────────────────────

export type PoFixtureInput = {
  number: string;
  poDate: string; // yyyy-mm-dd
  company: string;
  companyAddress: { line1: string; city: string; state: string; zip: string };
  shipToLabel?: string;
  buyer: { name: string; email: string; phone?: string };
  referencedQuote: string | null;
  terms: string;
  lines: ScenarioLine[];
  vendorNote?: string;
};

export type PoExtractionFixture = Record<string, unknown>;

export async function makePoPdf(input: PoFixtureInput): Promise<{ bytes: Uint8Array; extraction: PoExtractionFixture }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage(LETTER);

  const anchors: Record<string, Anchor> = {};

  // Letterhead
  page.drawText(input.company.toUpperCase(), { x: 54, y: 744, size: 13, font: bold, color: INK });
  page.drawText(
    `${input.companyAddress.line1} · ${input.companyAddress.city}, ${input.companyAddress.state} ${input.companyAddress.zip}`,
    { x: 54, y: 728, size: 8.5, font, color: MUTED },
  );

  page.drawText("PURCHASE ORDER", { x: 396, y: 744, size: 14, font: bold, color: INK });
  const poNumText = input.number;
  page.drawText(poNumText, { x: 396, y: 726, size: 11, font: mono, color: INK });
  anchors.customer_po_number = { page: 1, bbox: fbox(396, 726 + 11, mono.widthOfTextAtSize(poNumText, 11), 11) };
  page.drawText(`Date: ${input.poDate}`, { x: 396, y: 710, size: 9, font, color: INK });
  anchors.po_date = { page: 1, bbox: fbox(396, 710 + 9, font.widthOfTextAtSize(`Date: ${input.poDate}`, 9), 9) };

  page.drawLine({ start: { x: 54, y: 700 }, end: { x: 558, y: 700 }, thickness: 1, color: INK });

  // Vendor / bill-to / ship-to
  page.drawText("VENDOR", { x: 54, y: 682, size: 8, font: bold, color: MUTED });
  page.drawText("Meridian Surfaces Co.", { x: 54, y: 668, size: 9.5, font, color: INK });
  page.drawText("4210 Stuart Andrew Blvd", { x: 54, y: 656, size: 9, font, color: INK });
  page.drawText("Charlotte, NC 28217", { x: 54, y: 644, size: 9, font, color: INK });

  page.drawText("BILL TO", { x: 230, y: 682, size: 8, font: bold, color: MUTED });
  const billLines = [
    input.company,
    input.companyAddress.line1,
    `${input.companyAddress.city}, ${input.companyAddress.state} ${input.companyAddress.zip}`,
  ];
  billLines.forEach((t, i) => page.drawText(t, { x: 230, y: 668 - i * 12, size: 9, font, color: INK }));
  anchors.bill_to = { page: 1, bbox: fbox(230, 682, 170, 50) };

  page.drawText("SHIP TO", { x: 410, y: 682, size: 8, font: bold, color: MUTED });
  const shipLines = [
    input.shipToLabel ?? `${input.company} Warehouse`,
    input.companyAddress.line1,
    `${input.companyAddress.city}, ${input.companyAddress.state} ${input.companyAddress.zip}`,
  ];
  shipLines.forEach((t, i) => page.drawText(t, { x: 410, y: 668 - i * 12, size: 9, font, color: INK }));
  anchors.ship_to = { page: 1, bbox: fbox(410, 682, 148, 50) };

  // Buyer + reference
  let metaY = 618;
  const buyerText = `Buyer: ${input.buyer.name} · ${input.buyer.email}${input.buyer.phone ? " · " + input.buyer.phone : ""}`;
  page.drawText(buyerText, { x: 54, y: metaY, size: 9, font, color: INK });
  anchors.buyer_contact = { page: 1, bbox: fbox(54, metaY + 9, font.widthOfTextAtSize(buyerText, 9), 9) };
  metaY -= 14;
  if (input.referencedQuote) {
    const refText = `Reference: Meridian quote ${input.referencedQuote}`;
    page.drawText(refText, { x: 54, y: metaY, size: 9, font, color: INK });
    anchors.referenced_quote_number = { page: 1, bbox: fbox(54, metaY + 9, font.widthOfTextAtSize(refText, 9), 9) };
    metaY -= 14;
  }
  const termsText = `Terms: ${input.terms}`;
  page.drawText(termsText, { x: 54, y: metaY, size: 9, font, color: INK });
  anchors.terms = { page: 1, bbox: fbox(54, metaY + 9, font.widthOfTextAtSize(termsText, 9), 9) };

  // Line table
  const tableTop = metaY - 26;
  const cols = { sku: 54, desc: 150, qty: 356, uom: 396, unit: 440, ext: 502 };
  page.drawText("SKU", { x: cols.sku, y: tableTop, size: 8, font: bold, color: MUTED });
  page.drawText("DESCRIPTION", { x: cols.desc, y: tableTop, size: 8, font: bold, color: MUTED });
  page.drawText("QTY", { x: cols.qty, y: tableTop, size: 8, font: bold, color: MUTED });
  page.drawText("UOM", { x: cols.uom, y: tableTop, size: 8, font: bold, color: MUTED });
  page.drawText("UNIT PRICE", { x: cols.unit, y: tableTop, size: 8, font: bold, color: MUTED });
  page.drawText("EXTENDED", { x: cols.ext, y: tableTop, size: 8, font: bold, color: MUTED });
  page.drawLine({ start: { x: 54, y: tableTop - 6 }, end: { x: 558, y: tableTop - 6 }, thickness: 0.6, color: INK });

  const lineAnchors: Anchor[] = [];
  let rowY = tableTop - 22;
  for (const l of input.lines) {
    page.drawText(l.sku, { x: cols.sku, y: rowY, size: 9, font: mono, color: INK });
    page.drawText(`${l.name} architectural film`, { x: cols.desc, y: rowY, size: 9, font, color: INK });
    page.drawText(String(l.qty), { x: cols.qty, y: rowY, size: 9, font, color: INK });
    page.drawText("roll", { x: cols.uom, y: rowY, size: 9, font, color: INK });
    page.drawText(formatCentsExact(l.unitPriceCents), { x: cols.unit, y: rowY, size: 9, font, color: INK });
    page.drawText(formatCentsExact(l.qty * l.unitPriceCents), { x: cols.ext, y: rowY, size: 9, font, color: INK });
    lineAnchors.push({ page: 1, bbox: fbox(cols.sku, rowY + 9, 558 - cols.sku, 12) });
    page.drawLine({ start: { x: 54, y: rowY - 6 }, end: { x: 558, y: rowY - 6 }, thickness: 0.35, color: LINE });
    rowY -= 20;
  }

  // Totals
  const subtotal = input.lines.reduce((a, l) => a + l.qty * l.unitPriceCents, 0);
  const totalsY = rowY - 8;
  page.drawText("Subtotal", { x: 440, y: totalsY, size: 9, font: bold, color: INK });
  page.drawText(formatCentsExact(subtotal), { x: cols.ext, y: totalsY, size: 9, font, color: INK });
  page.drawText("Total", { x: 440, y: totalsY - 16, size: 10, font: bold, color: INK });
  page.drawText(formatCentsExact(subtotal), { x: cols.ext, y: totalsY - 16, size: 10, font: bold, color: INK });
  const totalsAnchor: Anchor = { page: 1, bbox: fbox(440, totalsY + 9, 118, 34) };

  const note = input.vendorNote ?? "Please confirm receipt and ship date. Partial shipments accepted with notice.";
  page.drawText(note, { x: 54, y: totalsY - 44, size: 8.5, font, color: MUTED });
  footer(page, font, `${input.number} · ${input.company} · fictional demo document`);

  const bytes = await doc.save();

  const extraction: PoExtractionFixture = {
    customer_po_number: { value: input.number, anchor: anchors.customer_po_number },
    po_date: { value: input.poDate, anchor: anchors.po_date },
    bill_to: {
      value: {
        company: input.company,
        line1: input.companyAddress.line1,
        line2: null,
        city: input.companyAddress.city,
        state: input.companyAddress.state,
        zip: input.companyAddress.zip,
      },
      anchor: anchors.bill_to,
    },
    ship_to: {
      value: {
        company: input.shipToLabel ?? `${input.company} Warehouse`,
        line1: input.companyAddress.line1,
        line2: null,
        city: input.companyAddress.city,
        state: input.companyAddress.state,
        zip: input.companyAddress.zip,
      },
      anchor: anchors.ship_to,
    },
    buyer_contact: {
      value: { name: input.buyer.name, email: input.buyer.email, phone: input.buyer.phone ?? null },
      anchor: anchors.buyer_contact,
    },
    // Required-but-nullable extraction contract: absent facts are explicit nulls.
    referenced_quote_number: input.referencedQuote
      ? { value: input.referencedQuote, anchor: anchors.referenced_quote_number }
      : null,
    lines: input.lines.map((l, i) => ({
      raw_sku_text: l.sku,
      description: `${l.name} architectural film`,
      qty: l.qty,
      uom: "roll",
      unit_price_cents: l.unitPriceCents,
      line_total_cents: l.qty * l.unitPriceCents,
      page: 1,
      bbox: lineAnchors[i]!.bbox ?? null,
    })),
    totals: { subtotal_cents: subtotal, tax_cents: null, total_cents: subtotal, page: totalsAnchor.page },
    terms: { value: input.terms, anchor: anchors.terms },
    notes: null,
  };

  return { bytes, extraction };
}
