/** Global PDS document library (WO-10 task 3) — all docs, filter by kind. */
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pdsDocuments, products } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const KINDS = ["pds", "install", "test_report", "warranty"];

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const rows = await db
    .select({ id: pdsDocuments.id, kind: pdsDocuments.kind, title: pdsDocuments.title, blobUrl: pdsDocuments.blobUrl, sku: products.sku })
    .from(pdsDocuments)
    .innerJoin(products, eq(products.id, pdsDocuments.productId))
    .orderBy(products.name);
  const docs = kind ? rows.filter((r) => r.kind === kind) : rows;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/catalog" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> catalog</Link>
        <h1 className="text-lg font-semibold tracking-tight">Documents</h1>
      </div>
      <Card>
        <CardHeader title="PDS library" right={<span className="font-mono text-[10px] text-ink-faint">{docs.length}</span>} />
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
          <Link href="/catalog/documents" className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", !kind ? "border-accent text-accent" : "border-line text-ink-muted")}>all</Link>
          {KINDS.map((k) => (
            <Link key={k} href={`/catalog/documents?kind=${k}`} className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", kind === k ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}>{k}</Link>
          ))}
        </div>
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <span className="truncate text-[12px]">{d.title}</span>
                <span className="shrink-0 rounded border border-line px-1 py-0.5 font-mono text-[9px] text-ink-muted">{d.kind}</span>
              </span>
              <a href={d.blobUrl} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[10px] text-accent hover:underline">open →</a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
