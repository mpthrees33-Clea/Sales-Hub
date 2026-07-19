/** Samples reads (WO-09). Server-only. */
import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, contacts, inventory, products, sampleOrders } from "@/db/schema";

export type SampleOrderRow = {
  id: string;
  status: string;
  accountName: string | null;
  contactName: string | null;
  orderedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: { sku: string; name: string; size: string; qty: number }[];
};

export async function listSampleOrders(): Promise<SampleOrderRow[]> {
  const rows = await db
    .select({ o: sampleOrders, accountName: accounts.name, contactName: contacts.name })
    .from(sampleOrders)
    .leftJoin(accounts, eq(accounts.id, sampleOrders.accountId))
    .leftJoin(contacts, eq(contacts.id, sampleOrders.contactId))
    .orderBy(desc(sampleOrders.createdAt));

  const prodRows = await db.select({ id: products.id, sku: products.sku, name: products.name }).from(products);
  const pById = new Map(prodRows.map((p) => [p.id, p]));

  return rows.map(({ o, accountName, contactName }) => ({
    id: o.id,
    status: o.status,
    accountName,
    contactName,
    orderedAt: o.orderedAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    items: o.items.map((i) => ({ sku: pById.get(i.productId)?.sku ?? "", name: pById.get(i.productId)?.name ?? "", size: i.size, qty: i.qty })),
  }));
}

export type CatalogRow = { id: string; sku: string; name: string; family: string; finish: string; swatchBlobUrl: string | null; leadTimeDays: number | null };

export async function listCatalog(query?: string, family?: string): Promise<CatalogRow[]> {
  const rows = await db
    .select({ id: products.id, sku: products.sku, name: products.name, family: products.family, finish: products.finish, swatchBlobUrl: products.swatchBlobUrl, leadTimeDays: inventory.leadTimeDays })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(query ? or(ilike(products.sku, `%${query}%`), ilike(products.name, `%${query}%`)) : undefined)
    .orderBy(products.name);
  return rows.filter((r) => !family || r.family === family);
}

export async function contactOptions(): Promise<{ id: string; name: string; accountId: string; accountName: string }[]> {
  return db
    .select({ id: contacts.id, name: contacts.name, accountId: contacts.accountId, accountName: accounts.name })
    .from(contacts)
    .innerJoin(accounts, eq(accounts.id, contacts.accountId))
    .orderBy(accounts.name);
}
