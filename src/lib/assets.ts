/**
 * The asset-library contract (WO-10 task 4) — the SINGLE source of
 * attachable files hub-wide. The policy gate's attachment-origin check and
 * WO-04's email drafting consume these helpers; no other implementation of
 * attachability exists (grep-enforced in review).
 *
 * Attachable = a row in `assets` (marketing library, incl. registered
 * presentation exports, scenes, and submittal packages) or a product
 * document in `pds_documents`. Both are library-of-record tables written
 * only through audited paths.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, pdsDocuments } from "@/db/schema";
import { audit } from "@/lib/audit";

export type AttachableAsset = {
  id: string;
  title: string;
  kind: string;
  blobUrl: string;
  source: "asset" | "pds_document";
};

/** Every attachable file, optionally filtered by kind or product. */
export async function getAttachableAssets(filter?: {
  kind?: string;
  productId?: string;
}): Promise<AttachableAsset[]> {
  const assetRows = await db.select().from(assets);
  const docRows = await db.select().from(pdsDocuments);
  const out: AttachableAsset[] = [
    ...assetRows.map((a) => ({ id: a.id, title: a.title, kind: a.kind as string, blobUrl: a.blobUrl, source: "asset" as const })),
    ...docRows.map((d) => ({ id: d.id, title: d.title, kind: d.kind as string, blobUrl: d.blobUrl, source: "pds_document" as const })),
  ];
  return out.filter((a) => {
    if (filter?.kind && a.kind !== filter.kind) return false;
    if (filter?.productId) {
      const asset = assetRows.find((x) => x.id === a.id);
      const doc = docRows.find((x) => x.id === a.id);
      if (asset && !asset.productIds.includes(filter.productId)) return false;
      if (doc && doc.productId !== filter.productId) return false;
    }
    return true;
  });
}

/** True iff every ref is a library asset or product document. */
export async function isAttachable(refs: string | string[]): Promise<boolean> {
  const ids = Array.isArray(refs) ? refs : [refs];
  if (ids.length === 0) return true;
  const [assetRows, docRows] = await Promise.all([
    db.select({ id: assets.id }).from(assets).where(inArray(assets.id, ids)),
    db.select({ id: pdsDocuments.id }).from(pdsDocuments).where(inArray(pdsDocuments.id, ids)),
  ]);
  const known = new Set([...assetRows.map((r) => r.id), ...docRows.map((r) => r.id)]);
  return ids.every((id) => known.has(id));
}

/** Register a new library asset (audited — the only legal insert path). */
export async function registerAsset(input: {
  kind: (typeof assets.$inferInsert)["kind"];
  title: string;
  blobUrl: string;
  contentType: string;
  tags?: string[];
  productIds?: string[];
  actor: `user:${string}` | `agent:${string}` | "system";
}): Promise<{ assetId: string }> {
  const [row] = await db
    .insert(assets)
    .values({
      kind: input.kind,
      title: input.title,
      blobUrl: input.blobUrl,
      contentType: input.contentType,
      tags: input.tags ?? [],
      productIds: input.productIds ?? [],
    })
    .returning({ id: assets.id });
  await audit({
    actor: input.actor,
    action: "asset.registered",
    objectType: "asset",
    objectId: row!.id,
    detail: { kind: input.kind, title: input.title },
  });
  return { assetId: row!.id };
}

export async function updateAssetTags(assetId: string, tags: string[], actor: `user:${string}`): Promise<void> {
  await db.update(assets).set({ tags }).where(eq(assets.id, assetId));
  await audit({ actor, action: "asset.tags_updated", objectType: "asset", objectId: assetId, detail: { tags } });
}
