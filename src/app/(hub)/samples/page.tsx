import Link from "next/link";
import Image from "next/image";
import { desc, eq, ilike, or } from "drizzle-orm";
import { Package, Plus } from "lucide-react";
import { db } from "@/db/client";
import { accounts, contacts, inventory, products, sampleOrders } from "@/db/schema";
import { Card, CardHeader, EmptyState, Mono, StatusPill } from "@/components/ui";
import { formatDateShort, relativeAge } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { cn } from "@/lib/utils";
import { progressSampleOrders } from "./actions";

export const dynamic = "force-dynamic";

const FAMILIES = ["all", "wood", "metal", "stone", "solid", "texture"] as const;

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; family?: string; q?: string }>;
}) {
  const { tab = "orders", family = "all", q } = await searchParams;
  // Lazy demo-clock progression (WO-09 task 6) — idempotent.
  await progressSampleOrders();
  const demoNow = await getDemoNow();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Samples</h1>
          <nav className="flex gap-1 font-mono text-[11px]">
            {["orders", "catalog"].map((t) => (
              <Link
                key={t}
                href={`/samples?tab=${t}`}
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  tab === t ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
                )}
              >
                {t}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/samples/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> New sample order
        </Link>
      </div>

      {tab === "catalog" ? <CatalogTab family={family} q={q} /> : <OrdersTab demoNow={demoNow} />}
      <p className="font-mono text-[10px] text-ink-faint">
        Samples are the sale — request → approvable confirmation in one overnight cycle. Default size 8×10:{" "}
        <span className="italic">a 2-inch chip misrepresents a wall.</span>
      </p>
    </div>
  );
}

async function OrdersTab({ demoNow }: { demoNow: Date }) {
  const rows = await db
    .select({ order: sampleOrders, accountName: accounts.name, contactName: contacts.name })
    .from(sampleOrders)
    .leftJoin(accounts, eq(accounts.id, sampleOrders.accountId))
    .leftJoin(contacts, eq(contacts.id, sampleOrders.contactId))
    .orderBy(desc(sampleOrders.createdAt))
    .limit(40);
  const allProducts = await db.select({ id: products.id, sku: products.sku, name: products.name, swatch: products.swatchBlobUrl }).from(products);
  const bySku = new Map(allProducts.map((p) => [p.id, p]));

  return (
    <Card>
      <CardHeader n="01" title="Sample orders" />
      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No sample orders in motion"
          copy="Requests become approvable confirmations in one overnight cycle; rep-initiated orders take under a minute."
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ order, accountName, contactName }) => (
            <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex -space-x-1.5">
                {order.items.slice(0, 3).map((item, i) => {
                  const p = bySku.get(item.productId);
                  return p?.swatch ? (
                    <Image
                      key={i}
                      src={p.swatch}
                      alt={p.name}
                      width={28}
                      height={28}
                      unoptimized
                      className="h-7 w-7 rounded-md border border-line object-cover"
                    />
                  ) : (
                    <span key={i} className="h-7 w-7 rounded-md border border-line bg-surface2" />
                  );
                })}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  {order.items
                    .map((item) => {
                      const p = bySku.get(item.productId);
                      return `${p?.name ?? "?"} (${item.size.replace("_", " ")}${item.qty > 1 ? ` ×${item.qty}` : ""})`;
                    })
                    .join(", ")}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                  {contactName ?? "—"} · {accountName ?? "—"}
                  {order.sourceEmailId ? (
                    <>
                      {" · "}
                      <Link href={`/email?t=`} className="text-accent">
                        from email
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <StatusTimeline order={order} />
              <span className="font-mono text-[10px] text-ink-faint">{relativeAge(order.createdAt, demoNow)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatusTimeline({
  order,
}: {
  order: { status: string; orderedAt: Date | null; shippedAt: Date | null; deliveredAt: Date | null };
}) {
  const steps: { label: string; at: Date | null; reached: boolean }[] = [
    { label: "ordered", at: order.orderedAt, reached: ["ordered", "shipped", "delivered"].includes(order.status) },
    { label: "shipped", at: order.shippedAt, reached: ["shipped", "delivered"].includes(order.status) },
    { label: "delivered", at: order.deliveredAt, reached: order.status === "delivered" },
  ];
  if (order.status === "pending_approval" || order.status === "draft") {
    return <StatusPill tone="warn">awaiting approval</StatusPill>;
  }
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <span key={s.label} className="flex items-center gap-1">
          {i > 0 ? <span className={cn("h-px w-4", s.reached ? "bg-ok" : "bg-line")} /> : null}
          <span
            className={cn("font-mono text-[9px]", s.reached ? "text-ok" : "text-ink-faint")}
            title={s.at ? formatDateShort(s.at) : undefined}
          >
            {s.label}
            {s.at ? ` ${formatDateShort(s.at)}` : ""}
          </span>
        </span>
      ))}
    </div>
  );
}

async function CatalogTab({ family, q }: { family: string; q?: string }) {
  const filters = [];
  if (family !== "all") filters.push(eq(products.family, family as "wood"));
  if (q) filters.push(or(ilike(products.sku, `%${q}%`), ilike(products.name, `%${q}%`)));
  const rows = await db
    .select({ p: products, lead: inventory.leadTimeDays })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(filters.length ? (filters.length > 1 ? (await import("drizzle-orm")).and(...filters) : filters[0]) : undefined)
    .orderBy(products.sku)
    .limit(80);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FAMILIES.map((f) => (
          <Link
            key={f}
            href={`/samples?tab=catalog&family=${f}`}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[11px]",
              family === f ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {f}
          </Link>
        ))}
        <form className="ml-auto">
          <input type="hidden" name="tab" value="catalog" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search SKU or name…"
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
          />
        </form>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map(({ p, lead }) => (
          <Card key={p.id} className="overflow-hidden">
            {p.swatchBlobUrl ? (
              <Image src={p.swatchBlobUrl} alt={p.name} width={320} height={160} unoptimized className="h-24 w-full object-cover" />
            ) : (
              <div className="h-24 w-full bg-surface2" />
            )}
            <div className="p-2.5">
              <Mono className="text-[10px] text-ink-faint">{p.sku}</Mono>
              <p className="truncate text-[12px] font-medium">{p.name}</p>
              <p className="font-mono text-[9px] text-ink-faint">
                {p.family} · {lead ?? "—"}d lead
              </p>
              <Link
                href={`/samples/new?product=${p.id}`}
                className="mt-1.5 inline-block text-[11px] text-accent hover:opacity-80"
              >
                Request sample →
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
