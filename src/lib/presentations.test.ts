/** WO-10: presentation slide composition, slide-union zod, PDF export → attachable asset. */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { buildSlides, createPresentation, exportPresentationPdf, SlideSchema } from "@/lib/presentations";
import { isAttachable } from "@/lib/assets";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("presentations", () => {
  it("composes title + product + closing slides", async () => {
    const three = await db.select({ id: products.id }).from(products).limit(3);
    const slides = await buildSlides(three.map((p) => p.id), "Deck");
    expect(slides).toHaveLength(5); // title + 3 + closing
    expect(slides[0]!.kind).toBe("title");
    expect(slides.at(-1)!.kind).toBe("closing");
    for (const s of slides) expect(() => SlideSchema.parse(s)).not.toThrow();
  });

  it("exports a PDF with one page per slide, registered as an attachable asset", async () => {
    const three = await db.select({ id: products.id }).from(products).limit(3);
    const { id } = await createPresentation("Export Deck", three.map((p) => p.id));
    const res = await exportPresentationPdf(id);
    expect(res.pages).toBe(5);
    expect(await isAttachable(res.assetId)).toBe(true);
  });
});
