/** Presentations list (WO-10 task 5). */
import Link from "next/link";
import { ArrowLeft, Presentation } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { presentations } from "@/db/schema";
import { Card, CardHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.select().from(presentations).orderBy(desc(presentations.createdAt));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/catalog" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> catalog</Link>
          <h1 className="text-lg font-semibold tracking-tight">Presentations</h1>
        </div>
        <Link href="/catalog/presentations/new" className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90">New</Link>
      </div>
      <Card>
        <CardHeader title="Decks" right={<span className="font-mono text-[10px] text-ink-faint">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={Presentation} title="No presentations yet" copy="Assemble product slides into a clean deck and export it as an attachable PDF." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-[13px] font-medium">{p.title} <span className="font-mono text-[10px] text-ink-faint">· {p.slides.length} slides</span></span>
                <div className="flex items-center gap-3">
                  {p.exportedAssetId ? <span className="font-mono text-[10px] text-ok">exported</span> : null}
                  <Link href={`/catalog/presentations/${p.id}/present`} className="font-mono text-[11px] text-accent hover:underline">present →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
