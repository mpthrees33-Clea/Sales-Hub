/**
 * Serves the local filesystem blob store (the Vercel-Blob fallback in
 * src/lib/blob.ts). Session-gated by middleware. On deployments with
 * BLOB_READ_WRITE_TOKEN, stored URLs are absolute Vercel Blob URLs and this
 * route is unused.
 */
import fs from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { contentTypeForKey, safeLocalPath } from "@/lib/blob";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  try {
    const data = await fs.readFile(safeLocalPath(joined));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": contentTypeForKey(joined),
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
