import { db } from "@/db/client";
import { products } from "@/db/schema";
import { NewPresentationClient } from "./new-client";

export const dynamic = "force-dynamic";

export default async function NewPresentationPage() {
  const rows = await db
    .select({ id: products.id, sku: products.sku, name: products.name, family: products.family, swatch: products.swatchBlobUrl })
    .from(products)
    .orderBy(products.family, products.name);
  return <NewPresentationClient products={rows} />;
}
