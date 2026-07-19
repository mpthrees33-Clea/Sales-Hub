import { db } from "@/db/client";
import { contacts, accounts, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SampleComposeClient } from "./compose-client";

export const dynamic = "force-dynamic";

export default async function NewSampleOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const [productRows, contactRows, accountRows] = await Promise.all([
    db
      .select({ id: products.id, sku: products.sku, name: products.name, swatch: products.swatchBlobUrl })
      .from(products)
      .orderBy(products.name),
    db.select({ id: contacts.id, name: contacts.name, accountId: contacts.accountId }).from(contacts).orderBy(contacts.name),
    db.select({ id: accounts.id, name: accounts.name, address: accounts.address }).from(accounts),
  ]);
  void eq;
  const accountById = new Map(accountRows.map((a) => [a.id, a]));
  return (
    <SampleComposeClient
      products={productRows}
      contacts={contactRows.map((c) => ({
        id: c.id,
        name: c.name,
        account: accountById.get(c.accountId)?.name ?? "",
        address: accountById.get(c.accountId)?.address ?? { line1: "", city: "", state: "", zip: "" },
      }))}
      preselectedProductId={product}
    />
  );
}
