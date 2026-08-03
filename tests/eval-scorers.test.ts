/**
 * Eval scorers are pure functions — locked in here so the published numbers
 * can be trusted: accuracy math, confusion-matrix shape, and the
 * fabricated/missed/wrong/nullsCorrect split (nulls are first-class facts).
 */
import { describe, expect, it } from "vitest";
import { flattenPoValues, scorePoExtraction, scoreTriage } from "../evals/lib/score";

describe("scoreTriage", () => {
  it("computes accuracy and a confusion matrix, ∅ for failed runs", () => {
    const s = scoreTriage([
      { id: "a", expected: "po", predicted: "po" },
      { id: "b", expected: "noise", predicted: "noise" },
      { id: "c", expected: "quote_request", predicted: "general" },
      { id: "d", expected: "scheduling", predicted: null },
    ]);
    expect(s.total).toBe(4);
    expect(s.correct).toBe(2);
    expect(s.accuracy).toBe(0.5);
    expect(s.confusion.po!.po).toBe(1);
    expect(s.confusion.quote_request!.general).toBe(1);
    expect(s.confusion.scheduling!["∅"]).toBe(1);
    expect(s.failures.map((f) => f.id)).toEqual(["c", "d"]);
  });
});

describe("flattenPoValues", () => {
  it("keeps values and nulls, drops anchors/pages/bboxes", () => {
    const flat = flattenPoValues({
      customer_po_number: { value: "PO-1", anchor: { page: 1, bbox: [0, 0, 1, 1] } },
      totals: { subtotal_cents: 100, tax_cents: null, total_cents: 100, page: 1 },
      lines: [{ raw_sku_text: "X", qty: 2, bbox: [0, 0, 1, 1], page: 1 }],
      notes: null,
    });
    expect(flat["customer_po_number.value"]).toBe("PO-1");
    expect(flat["totals.tax_cents"]).toBeNull();
    expect(flat["lines[0].qty"]).toBe(2);
    expect(flat["notes"]).toBeNull();
    expect(Object.keys(flat).some((k) => k.includes("anchor") || k.includes("bbox") || k.endsWith(".page"))).toBe(false);
  });
});

describe("scorePoExtraction", () => {
  const expected = {
    customer_po_number: { value: "PO-1", anchor: { page: 1, bbox: null } },
    totals: { subtotal_cents: 100, tax_cents: null, total_cents: 100, page: 1 },
    terms: null,
  };

  it("perfect match scores 100% and counts correct nulls", () => {
    const s = scorePoExtraction(expected, structuredClone(expected));
    expect(s.accuracy).toBe(1);
    expect(s.fabricated).toBe(0);
    expect(s.nullsCorrect).toBe(2); // tax_cents + terms
  });

  it("splits fabricated / missed / wrong", () => {
    const s = scorePoExtraction(expected, {
      customer_po_number: { value: "PO-9", anchor: { page: 1, bbox: null } }, // wrong
      totals: { subtotal_cents: null, tax_cents: 875, total_cents: 100, page: 1 }, // missed + fabricated
      terms: null, // correct null
    });
    expect(s.wrong).toBe(1);
    expect(s.missed).toBe(1);
    expect(s.fabricated).toBe(1);
    expect(s.nullsCorrect).toBe(1);
    const byPath = new Map(s.fields.map((f) => [f.path, f.outcome]));
    expect(byPath.get("totals.tax_cents")).toBe("fabricated");
    expect(byPath.get("totals.subtotal_cents")).toBe("missed");
    expect(byPath.get("customer_po_number.value")).toBe("wrong");
  });
});
