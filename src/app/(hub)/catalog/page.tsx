/** Catalog browse (WO-10 task 1) — swatch grid, family/finish/stock filters, search. */
import Link from "next/link";
import { Layers, Search } from "lucide-react";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db/client";
import { inventory, products } from "@/db/schema";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const FAMILIES = ["wood", "metal", "stone", "solid", "texture"];

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; family?: string; stock?: string }> }) {
  const { q, family, stock } = await searchParams;
  const rows = await db
    .select({ id: products.id, sku: products.sku, name: products.name, family: products.family, finish: products.finish, swatch: products.swatchBlobUrl, spec: products.spec, onHand: inventory.onHand, allocated: inventory.allocated, leadTimeDays: inventory.leadTimeDays })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(q ? or(ilike(products.sku, `%${q}%`), ilike(products.name, `%${q}%`), ilike(products.description, `%${q}%`)) : undefined, family ? eq(products.family, family as typeof products.$inferSelect.family) : undefined))
    .orderBy(products.name);
  const items = rows.filter((r) => (stock === "1" ? (r.onHand ?? 0) - (r.allocated ?? 0) > 0 : true));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Catalog</h1>
        <div className="flex items-center gap-3">
          <Link href="/catalog/documents" className="font-mono text-[11px] text-accent hover:underline">documents</Link>
          <Link href="/catalog/assets" className="font-mono text-[11px] text-accent hover:underline">assets</Link>
          <Link href="/catalog/presentations" className="font-mono text-[11px] text-accent hover:underline">presentations</Link>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Products"
          right={
            <form className="flex items-center gap-1">
              <Search className="h-3 w-3 text-ink-faint" />
              <input name="q" defaultValue={q} placeholder="sku / name" className="w-36 bg-transparent font-mono text-[11px] outline-none placeholder:text-ink-faint" />
              {family ? <input type="hidden" name="family" value={family} /> : null}
            </form>
          }
        />
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
          <Link href="/catalog" className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", !family && stock !== "1" ? "border-accent text-accent" : "border-line text-ink-muted")}>all</Link>
          {FAMILIES.map((f) => (
            <Link key={f} href={`/catalog?family=${f}`} className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] capitalize", family === f ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}>{f}</Link>
          ))}
          <Link href="/catalog?stock=1" className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", stock === "1" ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}>in stock</Link>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={Layers} title="No products match" copy="Adjust the family filter or search terms." />
        ) : (
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <Link key={p.id} href={`/catalog/${p.sku}`} className="rounded-lg border border-line bg-surface p-2 transition-colors hover:border-line-strong">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.swatch ? p.swatch : `/api/blob/swatches/${p.sku}.svg`} alt="" className="mb-2 h-24 w-full rounded-md border border-line object-cover" />
                <p className="truncate text-[12px] font-medium">{p.name}</p>
                <p className="font-mono text-[10px] text-ink-faint">{p.sku}</p>
                <p className="mt-0.5 text-[10px] text-ink-muted capitalize">{p.family} · {p.finish}</p>
                <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{p.spec?.fireRating ?? ""} · {p.leadTimeDays ?? "—"}d</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
