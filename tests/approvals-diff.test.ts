/** WO-03 task 8: edit-diff recording over nested objects and arrays of lines. */
import { describe, expect, it } from "vitest";
import { computeDiff } from "@/lib/approvals/diff";

describe("computeDiff", () => {
  it("returns [] for equal payloads", () => {
    const a = { to: ["x@y.example.com"], subject: "Hi", lines: [{ qty: 2, unitPriceCents: 100 }] };
    expect(computeDiff(a, structuredClone(a))).toEqual([]);
  });

  it("records a scalar field change", () => {
    const before = { subject: "Re: stock", bodyText: "old" };
    const after = { subject: "Re: stock", bodyText: "new" };
    expect(computeDiff(before, after)).toEqual([{ path: "bodyText", old: "old", new: "new" }]);
  });

  it("records nested array-of-lines changes with indexed paths", () => {
    const before = { lines: [{ qty: 2, unitPriceCents: 100 }, { qty: 5, unitPriceCents: 200 }] };
    const after = { lines: [{ qty: 3, unitPriceCents: 100 }, { qty: 5, unitPriceCents: 200 }] };
    expect(computeDiff(before, after)).toEqual([{ path: "lines[0].qty", old: 2, new: 3 }]);
  });

  it("records added and removed keys as leaf changes", () => {
    const before = { a: 1 };
    const after = { a: 1, b: 2 };
    const diff = computeDiff(before, after);
    expect(diff).toContainEqual({ path: "b", old: null, new: 2 });
  });

  it("handles a nested object plus a list edit together", () => {
    const before = { meta: { stage: "quoted" }, lines: [{ qty: 1 }] };
    const after = { meta: { stage: "po_received" }, lines: [{ qty: 4 }] };
    const diff = computeDiff(before, after);
    expect(diff).toContainEqual({ path: "meta.stage", old: "quoted", new: "po_received" });
    expect(diff).toContainEqual({ path: "lines[0].qty", old: 1, new: 4 });
  });
});
