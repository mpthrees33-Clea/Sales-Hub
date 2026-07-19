import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db/client";
import { activities, inventory, pdsDocuments, priceListItems, priceLists, products } from "@/db/schema";
import { Card, CardHeader, Mono, StatusPill } from "@/components/ui";
import { formatCentsExact } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { PdfPreviewLink } from "../_components/pdf-preview";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = await db.query.products.findFirst({ where: eq(products.sku, sku.toUpperCase()) });
  if (!product) notFound();

  const [inv, docs, listPrice, recent] = await Promise.all([
    db.query.inventory.findFirst({ where: eq(inventory.productId, product.id) }),
    db.select().from(pdsDocuments).where(eq(pdsDocuments.productId, product.id)),
    db
      .select({ priceCents: priceListItems.unitPriceCents })
      .from(priceListItems)
      .innerJoin(priceLists, eq(priceLists.id, priceListItems.priceListId))
      .where(eq(priceListItems.productId, product.id))
      .then((rows) => rows[0]?.priceCents),
    db
      .select()
      .from(activities)
      .where(eq(activities.refId, product.id))
      .orderBy(desc(activities.occurredAt))
      .limit(5),
  ]);
  const available = (inv?.onHand ?? 0) - (inv?.allocated ?? 0);
  const kindOrder = ["pds", "install", "test_report", "warranty"] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <Mono className="text-[11px] text-ink-faint">{product.sku}</Mono>
          <h1 className="text-lg font-semibold tracking-tight">{product.name}</h1>
        </div>
        <Link href="/catalog" className="font-mono text-[11px] text-ink-muted hover:text-ink">
          ← Catalog
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-1">
          {product.swatchBlobUrl ? (
            <Image src={product.swatchBlobUrl} alt={product.name} width={480} height={480} unoptimized className="aspect-square w-full object-cover" />
          ) : (
            <div className="aspect-square w-full bg-surface2" />
          )}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader n="01" title="Specification" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 p-4 text-[13px]">
              <Spec k="Family / finish" v={`${product.family} · ${product.finish}`} />
              <Spec k="Fire rating" v={product.spec.fireRating} />
              <Spec k="Thickness" v={`${product.spec.thicknessMm} mm`} />
              <Spec k="Width" v={`${product.spec.widthMm} mm`} />
              <Spec k="Adhesive" v={product.spec.adhesive} />
              <Spec k="Unit" v={product.unit} />
              <Spec k="List price" v={listPrice ? `${formatCentsExact(listPrice)}/roll` : "—"} />
              <Spec
                k="Stock"
                v={
                  <span className={available > 10 ? "text-ok" : "text-warn"}>
                    {available} available · {inv?.leadTimeDays ?? "—"}d lead
                  </span>
                }
              />
            </dl>
            <p className="border-t border-line px-4 py-2.5 text-[12px] leading-relaxed text-ink-muted">
              {product.description} Account-tier pricing lives in quotes.
            </p>
          </Card>

          <Card>
            <CardHeader n="02" title="Documents" />
            <ul className="divide-y divide-line">
              {kindOrder
                .map((k) => docs.find((d) => d.kind === k))
                .filter((d): d is NonNullable<typeof d> => Boolean(d))
                .map((d) => (
                  <li key={d.id} className="flex items-center gap-2.5 px-4 py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{d.title}</span>
                    <StatusPill tone="muted">{d.kind}</StatusPill>
                    <PdfPreviewLink url={d.blobUrl} title={d.title} />
                  </li>
                ))}
            </ul>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/samples/new?product=${product.id}`}
              className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90"
            >
              Order sample
            </Link>
            <Link
              href={`/scenes/new?product=${product.id}`}
              className="rounded-md border border-line px-3 py-1.5 text-[13px] hover:border-line-strong"
            >
              Generate room scene
            </Link>
          </div>

          {recent.length > 0 ? (
            <Card>
              <CardHeader n="03" title="Recent activity" />
              <ul className="divide-y divide-line">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-2 text-[12px]">
                    <span className="truncate">{a.summary}</span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">{formatDateTime(a.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
