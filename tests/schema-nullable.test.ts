/**
 * Anti-fabrication schema contract: model-reported facts are REQUIRED but
 * NULLABLE. The JSON Schema the model sees must carry explicit null unions
 * and list every property as required — the model asserts absence with null;
 * it can never silently omit a field, and it is told never to guess.
 */
import "@/lib/load-env";
import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { meetingFollowupOutput } from "@/agents/meeting-followup";
import { poExtraction } from "@/agents/po-intake";

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  not?: unknown;
};

const allowsNull = (node: JsonSchemaNode | undefined): boolean => {
  if (!node) return false;
  if (Array.isArray(node.type)) return node.type.includes("null");
  if (node.type === "null") return true;
  return (node.anyOf ?? []).some((n) => allowsNull(n));
};

describe("po-intake extraction schema — required-but-nullable", () => {
  const js = zodSchema(poExtraction).jsonSchema as JsonSchemaNode;

  it("marks every top-level property required (no silent omission)", () => {
    const props = Object.keys(js.properties ?? {});
    expect(props.length).toBeGreaterThan(0);
    expect((js.required ?? []).sort()).toEqual(props.sort());
  });

  it("extraction facts are nullable, not optional", () => {
    expect(allowsNull(js.properties!.referenced_quote_number)).toBe(true);
    expect(allowsNull(js.properties!.terms)).toBe(true);
    expect(allowsNull(js.properties!.notes)).toBe(true);
    expect(allowsNull(js.properties!.totals!.properties!.tax_cents)).toBe(true);
    const line = js.properties!.lines!.items!;
    expect(allowsNull(line.properties!.line_total_cents)).toBe(true);
    expect(allowsNull(line.properties!.bbox)).toBe(true);
    // never-null facts stay strict
    expect(allowsNull(js.properties!.customer_po_number)).toBe(false);
    expect(allowsNull(js.properties!.totals!.properties!.subtotal_cents)).toBe(false);
  });

  it("line items require every field including line_total_cents", () => {
    const line = js.properties!.lines!.items!;
    expect(line.required).toContain("line_total_cents");
    expect(line.required).toContain("bbox");
  });
});

describe("meeting-followup output schema — required-but-nullable", () => {
  const js = zodSchema(meetingFollowupOutput).jsonSchema as JsonSchemaNode;

  it("action items require an explicit due_hint (null when unstated)", () => {
    const item = js.properties!.action_items!.items!;
    expect(item.required).toContain("due_hint");
    expect(allowsNull(item.properties!.due_hint)).toBe(true);
  });

  it("opportunity updates require explicit opportunity_id/new_opportunity", () => {
    const upd = js.properties!.opportunity_updates!.items!;
    expect(upd.required).toContain("opportunity_id");
    expect(upd.required).toContain("new_opportunity");
    expect(allowsNull(upd.properties!.opportunity_id)).toBe(true);
    expect(allowsNull(upd.properties!.new_opportunity)).toBe(true);
  });
});
