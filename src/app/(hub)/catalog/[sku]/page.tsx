/** Product detail (WO-10 task 2) — spec, stock, PDS docs, sample/scene CTAs. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Package } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inventory, pdsDocuments, products } from "@/db/schema";
import { Card, CardHeader, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";
const KIND_LABEL: Record<string, string> = { pds: "Product Data Sheet", install: "Installation Guide", test_report: "ASTM E84 Test Report", warranty: "Limited Warranty" };

export default async function Page({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = await db.query.products.findFirst({ where: eq(products.sku, decodeURIComponent(sku)) });
  if (!product) notFound();
  const [inv] = await db.select().from(inventory).where(eq(inventory.productId, product.id)).limit(1);
  const docs = await db.select().from(pdsDocuments).where(eq(pdsDocuments.productId, product.id));
  const available = (inv?.onHand ?? 0) - (inv?.allocated ?? 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/catalog" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> catalog</Link>
        <h1 className="text-lg font-semibold tracking-tight">{product.name}</h1>
        <span className="font-mono text-[12px] text-ink-faint">{product.sku}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.swatchBlobUrl ?? `/api/blob/swatches/${product.sku}.svg`} alt="" className="h-56 w-full rounded-md border border-line object-cover" />
          <div className="mt-3 flex items-center gap-2">
            {available > 0 ? <StatusPill tone="ok">{available} available</StatusPill> : <StatusPill tone="warn">low stock</StatusPill>}
            <span className="font-mono text-[11px] text-ink-faint">{inv?.leadTimeDays ?? "—"}d lead</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href={`/samples/new?sku=${product.sku}`} className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-ink hover:opacity-90">Order sample</Link>
            <Link href={`/scenes?sku=${product.sku}`} className="rounded-md border border-line bg-surface2 px-3 py-1.5 text-[12px] font-medium hover:border-line-strong">Generate scene</Link>
          </div>
        </Card>

        <Card>
          <CardHeader title="Specification" />
          <dl className="divide-y divide-line">
            {([["Family", product.family], ["Finish", product.finish], ["Fire rating", product.spec.fireRating], ["Thickness", `${product.spec.thicknessMm} mm`], ["Width", `${product.spec.widthMm} mm`], ["Adhesive", product.spec.adhesive], ["Unit", product.unit]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-1.5">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{k}</dt>
                <dd className="text-right text-[12px] capitalize text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Documents" right={<span className="font-mono text-[10px] text-ink-faint">{docs.length}</span>} />
        {docs.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-ink-muted"><Package className="mx-auto mb-1 h-4 w-4" />No documents.</p>
        ) : (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-ink-faint" />
                  <span className="text-[12px]">{KIND_LABEL[d.kind] ?? d.kind}</span>
                  <span className="rounded border border-line px-1 py-0.5 font-mono text-[9px] text-ink-muted">{d.kind}</span>
                </span>
                <a href={d.blobUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-accent hover:underline">preview →</a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
