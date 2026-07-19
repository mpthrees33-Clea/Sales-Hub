import Link from "next/link";
import Image from "next/image";
import { and, eq, gt, ilike, or, type SQL } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import { db } from "@/db/client";
import { inventory, products } from "@/db/schema";
import { Card, EmptyState, Mono } from "@/components/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FAMILIES = ["all", "wood", "metal", "stone", "solid", "texture"] as const;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string; q?: string; fire?: string; stock?: string }>;
}) {
  const { family = "all", q, fire, stock } = await searchParams;
  const filters: SQL[] = [];
  if (family !== "all") filters.push(eq(products.family, family as "wood"));
  if (q) filters.push(or(ilike(products.sku, `%${q}%`), ilike(products.name, `%${q}%`), ilike(products.description, `%${q}%`))!);
  if (fire === "a") filters.push(ilike(products.description, "%Class A%"));
  if (stock === "in") filters.push(gt(inventory.onHand, 0));

  const rows = await db
    .select({ p: products, onHand: inventory.onHand, allocated: inventory.allocated, lead: inventory.leadTimeDays })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(products.family, products.sku);

  const mkHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const state = { family, q, fire, stock, ...patch };
    for (const [k, v] of Object.entries(state)) if (v && v !== "all") params.set(k, v);
    return `/catalog?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Catalog</h1>
        <nav className="flex gap-3 font-mono text-[11px] text-ink-muted">
          <Link href="/catalog/documents" className="hover:text-ink">Documents</Link>
          <Link href="/catalog/assets" className="hover:text-ink">Marketing assets</Link>
          <Link href="/catalog/presentations" className="hover:text-ink">Presentations</Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FAMILIES.map((f) => (
          <Link
            key={f}
            href={mkHref({ family: f })}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[11px]",
              family === f ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {f}
          </Link>
        ))}
        <Link
          href={mkHref({ fire: fire === "a" ? undefined : "a" })}
          className={cn(
            "rounded-full border px-2.5 py-1 font-mono text-[11px]",
            fire === "a" ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
          )}
        >
          Class A
        </Link>
        <Link
          href={mkHref({ stock: stock === "in" ? undefined : "in" })}
          className={cn(
            "rounded-full border px-2.5 py-1 font-mono text-[11px]",
            stock === "in" ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
          )}
        >
          In stock
        </Link>
        <form className="ml-auto">
          {family !== "all" ? <input type="hidden" name="family" value={family} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search sku / name / description…"
            className="w-56 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No products match" copy="Loosen the filters or clear the search." />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map(({ p, onHand, allocated, lead }) => {
            const available = (onHand ?? 0) - (allocated ?? 0);
            return (
              <Link key={p.id} href={`/catalog/${p.sku}`}>
                <Card className="overflow-hidden transition-colors hover:border-line-strong">
                  {p.swatchBlobUrl ? (
                    <Image src={p.swatchBlobUrl} alt={p.name} width={320} height={200} unoptimized className="h-28 w-full object-cover" />
                  ) : (
                    <div className="h-28 w-full bg-surface2" />
                  )}
                  <div className="p-2.5">
                    <Mono className="text-[10px] text-ink-faint">{p.sku}</Mono>
                    <p className="truncate text-[12px] font-medium">{p.name}</p>
                    <p className="mt-0.5 font-mono text-[9px] text-ink-faint">
                      {p.family} · {p.finish}
                    </p>
                    <p className={cn("mt-1 font-mono text-[9px]", available > 10 ? "text-ok" : available > 0 ? "text-warn" : "text-danger")}>
                      {available > 0 ? `${available} avail` : "backorder"} · {lead ?? "—"}d
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <p className="font-mono text-[10px] text-ink-faint">
        {rows.length} SKUs · the asset library below this catalog is the only legal source of email attachments hub-wide.
      </p>
    </div>
  );
}
