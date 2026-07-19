/** The consistency check fails loudly on a fixture referencing a non-seeded SKU. */
import { describe, expect, it } from "vitest";
import "@/lib/load-env";
import { db } from "@/db/client";
import { runConsistencyCheck } from "@/db/seed/consistency";

describe("seed consistency check", () => {
  it("passes on the seeded scenario", async () => {
    const res = await runConsistencyCheck(db);
    expect(res.misses).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("fails with named misses when a fixture references a non-seeded SKU or quote", async () => {
    const res = await runConsistencyCheck(db, {
      skus: ["MS-ZZ-9999"],
      quotes: ["Q-9999"],
      scannedTexts: ["Please price MS-QQ-1234 against quote Q-8888."],
    });
    expect(res.ok).toBe(false);
    expect(res.misses).toContain("sku:MS-ZZ-9999");
    expect(res.misses).toContain("quote:Q-9999");
    expect(res.misses).toContain("sku:MS-QQ-1234");
    expect(res.misses).toContain("quote:Q-8888");
  });
});
