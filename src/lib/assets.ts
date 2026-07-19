/**
 * Attachable-asset contract (WO-10 task 4) — the SINGLE source of truth for what
 * may be attached to an outbound email. The policy gate's attachment-origin rule
 * and email/meeting drafting both treat "attachable" as: a marketing `assets`
 * row OR a `pds_documents` row. These helpers are that definition in query form.
 */
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, pdsDocuments, products } from "@/db/schema";
import { audit } from "@/lib/audit";

export type AttachableAsset = { id: string; title: string; kind: string; source: "asset" | "pds"; blobUrl: string; productId?: string };

/** All attachable files, optionally filtered by tag / free-text / product. */
export async function getAttachableAssets(filter?: { tags?: string[]; query?: string; productId?: string }): Promise<AttachableAsset[]> {
  const assetRows = await db.select().from(assets);
  const wantTags = (filter?.tags ?? []).map((t) => t.toLowerCase());
  const q = filter?.query?.toLowerCase();
  const assetOut: AttachableAsset[] = assetRows
    .filter((a) => (wantTags.length ? a.tags.some((t) => wantTags.includes(t.toLowerCase())) : true))
    .filter((a) => (q ? a.title.toLowerCase().includes(q) : true))
    .filter((a) => (filter?.productId ? a.productIds.includes(filter.productId) : true))
    .map((a) => ({ id: a.id, title: a.title, kind: a.kind, source: "asset" as const, blobUrl: a.blobUrl, productIds: a.productIds }))
    .map(({ productIds, ...rest }) => ({ ...rest, productId: productIds[0] }));

  const pdsRows = filter?.productId
    ? await db.select().from(pdsDocuments).where(eq(pdsDocuments.productId, filter.productId))
    : q
      ? await db.select().from(pdsDocuments).where(ilike(pdsDocuments.title, `%${q}%`))
      : await db.select().from(pdsDocuments);
  const pdsOut: AttachableAsset[] = pdsRows.map((d) => ({ id: d.id, title: d.title, kind: d.kind, source: "pds" as const, blobUrl: d.blobUrl, productId: d.productId }));

  return [...assetOut, ...pdsOut];
}

/** True iff `id` names a real attachable file (marketing asset or PDS document). */
export async function isAttachable(id: string): Promise<boolean> {
  const a = await db.select({ id: assets.id }).from(assets).where(eq(assets.id, id)).limit(1);
  if (a.length) return true;
  const d = await db.select({ id: pdsDocuments.id }).from(pdsDocuments).where(eq(pdsDocuments.id, id)).limit(1);
  return d.length > 0;
}

/** Bulk membership check (email drafting resolves attachment lists through this). */
export async function filterAttachable(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [a, d] = await Promise.all([
    db.select({ id: assets.id }).from(assets).where(inArray(assets.id, ids)),
    db.select({ id: pdsDocuments.id }).from(pdsDocuments).where(inArray(pdsDocuments.id, ids)),
  ]);
  return new Set([...a.map((r) => r.id), ...d.map((r) => r.id)]);
}

/** Register an uploaded marketing asset (audit-logged). */
export async function registerAsset(input: { kind: "brochure" | "case_study" | "presentation" | "scene" | "swatch" | "submittal"; title: string; blobUrl: string; contentType: string; tags?: string[]; productIds?: string[] }): Promise<string> {
  const [row] = await db
    .insert(assets)
    .values({ kind: input.kind, title: input.title, blobUrl: input.blobUrl, contentType: input.contentType, tags: input.tags ?? [], productIds: input.productIds ?? [] })
    .returning({ id: assets.id });
  await audit({ actor: "system", action: "asset.registered", objectType: "asset", objectId: row!.id, detail: { kind: input.kind, title: input.title } });
  return row!.id;
}

/** Product search for the catalog + presentation builder (ILIKE, no external dep). */
export async function searchCatalog(query?: string, family?: string): Promise<{ id: string; sku: string; name: string; family: string; finish: string; swatchBlobUrl: string | null }[]> {
  return db
    .select({ id: products.id, sku: products.sku, name: products.name, family: products.family, finish: products.finish, swatchBlobUrl: products.swatchBlobUrl })
    .from(products)
    .where(
      and(
        query ? or(ilike(products.sku, `%${query}%`), ilike(products.name, `%${query}%`), ilike(products.description, `%${query}%`)) : undefined,
        family ? eq(products.family, family as typeof products.$inferSelect.family) : undefined,
      ),
    )
    .orderBy(desc(products.name));
}
