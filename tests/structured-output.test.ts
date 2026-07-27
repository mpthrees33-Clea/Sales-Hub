/**
 * Structured output as tool use: the agent's output schema is sent to the
 * model as the submit_result tool's inputSchema — JSON is enforced at
 * generation time, not regex-scraped from prose after the fact. The prose
 * fallback (extractJson) survives for models that answer in text anyway.
 */
import "@/lib/load-env";
import { describe, expect, it } from "vitest";
import { poExtraction } from "@/agents/po-intake";
import { buildSubmitResultTool, extractJson } from "@/harness/define-agent";
import { EscalationError } from "@/harness/errors";

const findNodes = (node: unknown, out: unknown[] = []): unknown[] => {
  if (node && typeof node === "object") {
    out.push(node);
    for (const v of Object.values(node as Record<string, unknown>)) findNodes(v, out);
  }
  return out;
};

describe("buildSubmitResultTool — the schema the model actually sees", () => {
  const captured: unknown[] = [];
  const tool = buildSubmitResultTool(poExtraction, (args) => captured.push(args));
  const js = (tool.inputSchema as { jsonSchema: unknown }).jsonSchema;

  it("transmits the full extraction schema with null unions", () => {
    const text = JSON.stringify(js);
    expect(text).toContain("customer_po_number");
    expect(text).toContain("null"); // required-but-nullable unions made it through
    expect(text).toContain("never guess"); // .describe() guidance rides along
  });

  it("contains no unsatisfiable {'not':{}} nodes (the z.undefined() landmine)", () => {
    for (const node of findNodes(js)) {
      expect(JSON.stringify((node as { not?: unknown }).not ?? null)).not.toBe("{}");
    }
  });

  it("captures the submitted args and acknowledges", async () => {
    const result = await (tool as { execute: (a: unknown, o: unknown) => Promise<unknown> }).execute(
      { fake: true },
      {},
    );
    expect(result).toEqual({ accepted: true });
    expect(captured).toEqual([{ fake: true }]);
  });
});

describe("extractJson prose fallback (regression)", () => {
  it("parses fenced JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("parses bare JSON with surrounding prose", () => {
    expect(extractJson('Here you go: {"a":{"b":2}} hope that helps')).toEqual({ a: { b: 2 } });
  });
  it("escalates on no JSON", () => {
    expect(() => extractJson("no json here")).toThrow(EscalationError);
  });
});
