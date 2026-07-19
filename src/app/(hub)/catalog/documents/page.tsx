import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pdsDocuments, products } from "@/db/schema";
import { Card, CardHeader, Mono, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PdfPreviewLink } from "../_components/pdf-preview";

export const dynamic = "force-dynamic";

const KINDS = ["all", "pds", "install", "test_report", "warranty"] as const;

/** Global document library (WO-10 task 3) — the submittal-builder story. */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  const { kind = "all", q } = await searchParams;
  const rows = await db
    .select({ doc: pdsDocuments, sku: products.sku, productName: products.name })
    .from(pdsDocuments)
    .innerJoin(products, eq(products.id, pdsDocuments.productId))
    .orderBy(products.sku, pdsDocuments.kind);
  const filtered = rows.filter(
    (r) =>
      (kind === "all" || r.doc.kind === kind) &&
      (!q || (r.doc.title + r.sku).toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Document library</h1>
        <Link href="/catalog" className="font-mono text-[11px] text-ink-muted hover:text-ink">
          ← Catalog
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <Link
            key={k}
            href={`/catalog/documents?kind=${k}${q ? `&q=${q}` : ""}`}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[11px]",
              kind === k ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {k.replace("_", " ")}
          </Link>
        ))}
        <form className="ml-auto">
          {kind !== "all" ? <input type="hidden" name="kind" value={kind} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title or SKU…"
            className="w-56 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
          />
        </form>
      </div>
      <Card>
        <CardHeader n="01" title={`${filtered.length} documents — every one attachable and submittal-legal`} />
        <ul className="divide-y divide-line">
          {filtered.slice(0, 120).map(({ doc, sku }) => (
            <li key={doc.id} className="flex items-center gap-2.5 px-4 py-2">
              <Mono className="w-28 shrink-0 text-[11px] text-ink-faint">{sku}</Mono>
              <span className="min-w-0 flex-1 truncate text-[12px]">{doc.title}</span>
              <StatusPill tone="muted">{doc.kind}</StatusPill>
              <PdfPreviewLink url={doc.blobUrl} title={doc.title} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
