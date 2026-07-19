/** Submittal builder (WO-14 task 5) — pick project + products → agent proposes → approval. */
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { products, projects } from "@/db/schema";
import { SubmittalBuilder } from "./builder";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string; products?: string; subject?: string }> }) {
  const sp = await searchParams;
  const projectRows = await db.select({ id: projects.id, name: projects.name, gcName: projects.gcName, architectName: projects.architectName }).from(projects).orderBy(asc(projects.name));
  const catalog = await db.select({ id: products.id, sku: products.sku, name: products.name, family: products.family }).from(products).orderBy(asc(products.name));

  return (
    <SubmittalBuilder
      projects={projectRows}
      catalog={catalog}
      preselectProjectId={sp.project ?? null}
      preselectProductIds={sp.products ? sp.products.split(",").filter(Boolean) : []}
      sourceSubject={sp.subject ?? null}
    />
  );
}
