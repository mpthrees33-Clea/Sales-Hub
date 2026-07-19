/** WO-04: StyleCard zod round-trip (structure is fixed even when content varies). */
import { describe, expect, it } from "vitest";
import "@/lib/load-env";
import { StyleCardSchema } from "@/lib/style/profile";

describe("StyleCard schema", () => {
  it("round-trips a valid card", () => {
    const card = {
      greetingPatterns: ["{First},", "Hi {First},"],
      signoff: "—Cole",
      register: "concise, warm, direct",
      phrasePreferences: ["I'll get that over to you"],
      avoid: ["circling back"],
      avgLengthWords: 62,
      fewShotSnippets: ["Dana, Quote is attached. —Cole"],
    };
    const parsed = StyleCardSchema.parse(card);
    expect(parsed.signoff).toBe("—Cole");
    expect(parsed.avgLengthWords).toBe(62);
  });

  it("rejects a card missing the signoff", () => {
    const bad = { greetingPatterns: ["Hi,"], register: "x", phrasePreferences: [], avoid: [], avgLengthWords: 40, fewShotSnippets: ["s"] };
    expect(() => StyleCardSchema.parse(bad)).toThrow();
  });

  it("rejects more than five few-shot snippets", () => {
    const bad = {
      greetingPatterns: ["Hi,"],
      signoff: "—Cole",
      register: "x",
      phrasePreferences: [],
      avoid: [],
      avgLengthWords: 40,
      fewShotSnippets: ["1", "2", "3", "4", "5", "6"],
    };
    expect(() => StyleCardSchema.parse(bad)).toThrow();
  });
});
