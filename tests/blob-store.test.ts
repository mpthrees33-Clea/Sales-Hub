/**
 * Blob store resolution: app-relative "/api/blob/<key>" references exist in
 * seed fixtures and attachment payloads regardless of which store wrote the
 * bytes. On Vercel Blob deployments the serverless filesystem never has them
 * — getBlobBuffer must resolve the key through the store, not read local
 * disk (the production nightly crashed on exactly this).
 */
import "@/lib/load-env";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  usingLocalBlobStore: false, // simulate a Vercel Blob deployment
}));

vi.mock("@vercel/blob", () => ({
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({
    blobs:
      prefix === "fixtures/transcript-harborview.json"
        ? [
            { pathname: "fixtures/transcript-harborview.json.bak", url: "https://blob.example/wrong" },
            { pathname: "fixtures/transcript-harborview.json", url: "https://blob.example/right" },
          ]
        : [],
  })),
}));

import { getBlobBuffer, resolveBlobKeyUrl } from "@/lib/blob";

afterEach(() => vi.unstubAllGlobals());

describe("blob resolution on Vercel Blob deployments", () => {
  it("resolves an app-relative key to the exact store URL (not a prefix cousin)", async () => {
    const url = await resolveBlobKeyUrl("fixtures/transcript-harborview.json");
    expect(url).toBe("https://blob.example/right");
  });

  it("getBlobBuffer fetches from the store instead of the local filesystem", async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from('{"segments":[]}')));
    vi.stubGlobal("fetch", fetchMock);
    const buf = await getBlobBuffer("/api/blob/fixtures/transcript-harborview.json");
    expect(buf.toString()).toBe('{"segments":[]}');
    expect(fetchMock).toHaveBeenCalledWith("https://blob.example/right");
  });

  it("throws a clear error for a key missing from the store", async () => {
    await expect(resolveBlobKeyUrl("fixtures/nope.json")).rejects.toThrow(/not found in store/);
  });
});
