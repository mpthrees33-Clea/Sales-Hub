/** Manual sample-order compose (WO-09 task 3). */
import { contactOptions, listCatalog } from "@/lib/queries/samples";
import { ComposeSample } from "./compose";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  const { sku } = await searchParams;
  const [contacts, catalog] = await Promise.all([contactOptions(), listCatalog()]);
  return <ComposeSample contacts={contacts} catalog={catalog.map((c) => ({ id: c.id, sku: c.sku, name: c.name }))} prefillSku={sku ?? null} />;
}
