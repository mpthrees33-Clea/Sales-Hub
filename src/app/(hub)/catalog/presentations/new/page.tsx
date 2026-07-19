/** New presentation (WO-10 task 5) — pick products, auto-compose slides. */
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { NewPresentation } from "./builder";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.select({ id: products.id, sku: products.sku, name: products.name, family: products.family }).from(products).orderBy(products.name);
  return <NewPresentation catalog={rows} />;
}
