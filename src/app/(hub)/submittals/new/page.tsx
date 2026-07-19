import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, products, projects, submittalPackages } from "@/db/schema";
import { SubmittalBuilderClient } from "./builder-client";

export const dynamic = "force-dynamic";

/**
 * Builder entry (WO-14 task 5). `?package=<id>` prefills from a prepared
 * draft session (the routed overnight path) — project, products, and source
 * email land already selected; the human reviews and composes.
 */
export default async function NewSubmittalPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const { package: packageId } = await searchParams;

  const [projectRows, productRows] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, accountName: accounts.name })
      .from(projects)
      .innerJoin(accounts, eq(accounts.id, projects.accountId))
      .orderBy(projects.name),
    db
      .select({ id: products.id, sku: products.sku, name: products.name, family: products.family })
      .from(products)
      .orderBy(products.name),
  ]);

  let prefill: { packageId: string; projectId: string; productIds: string[]; sourceEmailId?: string } | undefined;
  if (packageId) {
    const draft = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.id, packageId) });
    if (draft && draft.status === "draft") {
      prefill = {
        packageId: draft.id,
        projectId: draft.projectId,
        productIds: draft.productIds,
        sourceEmailId: draft.sourceEmailId ?? undefined,
      };
    }
  }

  return <SubmittalBuilderClient projects={projectRows} products={productRows} prefill={prefill} />;
}
