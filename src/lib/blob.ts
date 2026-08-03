/**
 * Blob storage seam (docs/01-ARCHITECTURE.md — Vercel Blob). With
 * BLOB_READ_WRITE_TOKEN set, files go to Vercel Blob. Without it (local dev,
 * this environment), files live under var/blob/ and are served by
 * /api/blob/[...key] behind the session check. Size/type limits are enforced
 * here, before any write (docs/02-SECURITY-FRAMEWORK.md §5).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { env, usingLocalBlobStore } from "@/lib/env";

const LOCAL_ROOT = path.join(process.cwd(), "var", "blob");

export const BLOB_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".json": "application/json",
  ".txt": "text/plain",
};

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export type PutBlobOptions = { contentType: string; maxBytes?: number };

/**
 * Write a blob. `key` is a stable path like "po/PO-88121.pdf". Returns the
 * public URL to store in the DB (absolute on Vercel Blob, app-relative
 * "/api/blob/…" on the local store).
 */
export async function putBlob(key: string, data: Buffer | Uint8Array | string, opts: PutBlobOptions): Promise<string> {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  if (buf.byteLength > maxBytes) {
    throw new Error(`blob ${key} exceeds max size (${buf.byteLength} > ${maxBytes} bytes)`);
  }
  const ext = path.extname(key).toLowerCase();
  const expected = BLOB_CONTENT_TYPES[ext];
  if (!expected) throw new Error(`blob ${key}: unsupported extension "${ext}"`);
  if (expected !== opts.contentType) {
    throw new Error(`blob ${key}: contentType ${opts.contentType} does not match extension ${ext}`);
  }

  if (!usingLocalBlobStore) {
    const { put } = await import("@vercel/blob");
    const res = await put(key, buf, {
      access: "public",
      contentType: opts.contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return res.url;
  }

  const target = safeLocalPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buf);
  return `/api/blob/${key}`;
}

/** True if a blob already exists (seed fixture reuse). */
export async function blobExists(key: string): Promise<boolean> {
  if (!usingLocalBlobStore) {
    const { head } = await import("@vercel/blob");
    try {
      await head(key, { token: env.BLOB_READ_WRITE_TOKEN });
      return true;
    } catch {
      return false;
    }
  }
  try {
    await fs.access(safeLocalPath(key));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a blob KEY to a fetchable URL in the ACTIVE store. Needed because
 * some references are stored as app-relative "/api/blob/<key>" strings (seed
 * fixtures, attachment payloads) regardless of which store wrote the bytes.
 */
export async function resolveBlobKeyUrl(key: string): Promise<string> {
  if (usingLocalBlobStore) return `/api/blob/${key}`;
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: key, limit: 10, token: env.BLOB_READ_WRITE_TOKEN });
  const hit = blobs.find((b) => b.pathname === key);
  if (!hit) throw new Error(`blob not found in store: ${key}`);
  return hit.url;
}

/** Read a blob's bytes server-side from a stored URL (local or remote). */
export async function getBlobBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("/api/blob/")) {
    const key = url.slice("/api/blob/".length);
    if (!usingLocalBlobStore) {
      // Production (Vercel Blob): the serverless filesystem never has the
      // bytes — resolve the key to its store URL and fetch it.
      const res = await fetch(await resolveBlobKeyUrl(key));
      if (!res.ok) throw new Error(`blob fetch failed: ${res.status} ${key}`);
      return Buffer.from(await res.arrayBuffer());
    }
    return Buffer.from(await fs.readFile(safeLocalPath(key)));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`blob fetch failed: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Resolve + contain a key inside the local blob root (no traversal). */
export function safeLocalPath(key: string): string {
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error(`invalid blob key: ${key}`);
  return resolved;
}

export function contentTypeForKey(key: string): string {
  return BLOB_CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}
