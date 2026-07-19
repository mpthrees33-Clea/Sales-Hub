/** WO-10: the attachable-asset contract — the single source of what may be attached. */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, pdsDocuments, products } from "@/db/schema";
import { filterAttachable, getAttachableAssets, isAttachable } from "@/lib/assets";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("attachable assets", () => {
  it("includes marketing assets and PDS documents", async () => {
    const all = await getAttachableAssets();
    expect(all.some((a) => a.source === "asset")).toBe(true);
    expect(all.some((a) => a.source === "pds")).toBe(true);
  });

  it("scopes PDS docs to a product", async () => {
    const [walnut] = await db.select({ id: products.id }).from(products).where(eq(products.sku, "MS-WG-1147"));
    const docs = await getAttachableAssets({ productId: walnut!.id });
    const kinds = new Set(docs.filter((d) => d.source === "pds").map((d) => d.kind));
    expect(kinds.has("pds")).toBe(true);
    expect(kinds.has("install")).toBe(true);
  });

  it("isAttachable is true for a real PDS/asset id and false for a random id", async () => {
    const [doc] = await db.select({ id: pdsDocuments.id }).from(pdsDocuments).limit(1);
    const [asset] = await db.select({ id: assets.id }).from(assets).limit(1);
    expect(await isAttachable(doc!.id)).toBe(true);
    expect(await isAttachable(asset!.id)).toBe(true);
    expect(await isAttachable(randomUUID())).toBe(false);
  });

  it("filterAttachable returns only the known ids", async () => {
    const [doc] = await db.select({ id: pdsDocuments.id }).from(pdsDocuments).limit(1);
    const bogus = randomUUID();
    const set = await filterAttachable([doc!.id, bogus]);
    expect(set.has(doc!.id)).toBe(true);
    expect(set.has(bogus)).toBe(false);
  });
});
