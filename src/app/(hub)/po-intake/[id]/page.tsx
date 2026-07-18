import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, purchaseOrders, salesOrders } from "@/db/schema";
import { PoDetailClient } from "./detail-client";

export const dynamic = "force-dynamic";

export default async function PoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ field?: string }>;
}) {
  const { id } = await params;
  const { field } = await searchParams;
  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
  if (!po) notFound();
  const account = po.accountId
    ? await db.query.accounts.findFirst({ where: eq(accounts.id, po.accountId) })
    : null;
  const so = await db.query.salesOrders.findFirst({ where: eq(salesOrders.poId, id) });

  return (
    <PoDetailClient
      po={{
        id: po.id,
        blobUrl: po.blobUrl,
        status: po.status,
        customerPoNumber: po.customerPoNumber,
        accountName: account?.name ?? null,
        extracted: po.extracted,
        validation: po.validation,
        elapsedMs: po.elapsedMs,
        salesOrderNumber: so?.number ?? null,
      }}
      initialField={field}
    />
  );
}
