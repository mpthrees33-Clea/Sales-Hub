/**
 * Samples (WO-09) — Orders + Catalog tabs. Progression runs lazily on load so
 * statuses advance with the demo clock. Samples are the sale; speed is the value.
 */
import Link from "next/link";
import { Package, Search } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getDemoNow } from "@/lib/demo-clock";
import { progressSampleOrders } from "@/lib/samples";
import { listCatalog, listSampleOrders } from "@/lib/queries/samples";
import { StatusTimeline } from "./components/status-timeline";

export const dynamic = "force-dynamic";

const FAMILIES = ["wood", "metal", "stone", "solid", "texture"];

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; family?: string }> }) {
  const { tab = "orders", q, family } = await searchParams;
  await progressSampleOrders(await getDemoNow()); // lazy demo-clock progression

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Samples</h1>
        <Link href="/samples/new" className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90">
          New sample order
        </Link>
      </div>

      <div className="flex gap-1.5">
        {["orders", "catalog"].map((t) => (
          <Link key={t} href={`/samples?tab=${t}`} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition-colors", tab === t ? "bg-surface2 text-ink" : "text-ink-muted hover:text-ink")}>
            {t}
          </Link>
        ))}
      </div>

      {tab === "catalog" ? <Catalog q={q} family={family} /> : <Orders />}
    </div>
  );
}

async function Orders() {
  const orders = await listSampleOrders();
  return (
    <Card>
      <CardHeader title="Sample orders" right={<span className="font-mono text-[10px] text-ink-faint">{orders.length}</span>} />
      {orders.length === 0 ? (
        <EmptyState icon={Package} title="No sample orders yet" copy="Requests become approvable confirmations in one overnight cycle; compose one from the catalog in under a minute." />
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((o) => (
            <li key={o.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{o.contactName ?? "—"} <span className="text-ink-faint">· {o.accountName}</span></p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {o.items.map((it, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/blob/swatches/${it.sku}.svg`} alt="" className="h-3.5 w-3.5 rounded-sm" />
                        {it.name} · {it.size.replace("_", " ")} ×{it.qty}
                      </span>
                    ))}
                  </div>
                </div>
                <StatusTimeline status={o.status} orderedAt={o.orderedAt} shippedAt={o.shippedAt} deliveredAt={o.deliveredAt} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function Catalog({ q, family }: { q?: string; family?: string }) {
  const items = await listCatalog(q, family);
  return (
    <Card>
      <CardHeader
        title="Catalog"
        right={
          <form className="flex items-center gap-1">
            <Search className="h-3 w-3 text-ink-faint" />
            <input name="q" defaultValue={q} placeholder="sku or name" className="w-32 bg-transparent font-mono text-[11px] outline-none placeholder:text-ink-faint" />
            <input type="hidden" name="tab" value="catalog" />
          </form>
        }
      />
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
        <Link href="/samples?tab=catalog" className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", !family ? "border-accent text-accent" : "border-line text-ink-muted")}>all</Link>
        {FAMILIES.map((f) => (
          <Link key={f} href={`/samples?tab=catalog&family=${f}`} className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] capitalize", family === f ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}>{f}</Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <div key={p.id} className="rounded-lg border border-line bg-surface p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.swatchBlobUrl ? p.swatchBlobUrl : `/api/blob/swatches/${p.sku}.svg`} alt="" className="mb-2 h-20 w-full rounded-md border border-line object-cover" />
            <p className="truncate text-[12px] font-medium">{p.name}</p>
            <p className="font-mono text-[10px] text-ink-faint">{p.sku}</p>
            <p className="mt-0.5 text-[10px] text-ink-muted capitalize">{p.family} · {p.finish}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-mono text-[9px] text-ink-faint">{p.leadTimeDays ?? "—"}d lead</span>
              <Link href={`/samples/new?sku=${p.sku}`} className="font-mono text-[10px] text-accent hover:underline">request →</Link>
            </div>
          </div>
        ))}
      </div>
      <p className="px-4 py-2 font-mono text-[10px] text-ink-faint">Default size 8×10 — a 2-inch chip misrepresents a wall.</p>
    </Card>
  );
}
