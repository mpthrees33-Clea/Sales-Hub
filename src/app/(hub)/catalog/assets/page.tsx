/** Marketing asset library (WO-10 task 4) — browse + tag filter + upload. */
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { db } from "@/db/client";
import { assets } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AssetUploader } from "./uploader";

export const dynamic = "force-dynamic";
const KINDS = ["brochure", "case_study", "presentation", "scene", "swatch", "submittal"];

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const rows = await db.select().from(assets).orderBy(assets.title);
  const list = kind ? rows.filter((r) => r.kind === kind) : rows;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/catalog" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> catalog</Link>
        <h1 className="text-lg font-semibold tracking-tight">Assets</h1>
      </div>

      <AssetUploader />

      <Card>
        <CardHeader title="Library" right={<span className="font-mono text-[10px] text-ink-faint">{list.length} · the only legal attachment source</span>} />
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
          <Link href="/catalog/assets" className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", !kind ? "border-accent text-accent" : "border-line text-ink-muted")}>all</Link>
          {KINDS.map((k) => (
            <Link key={k} href={`/catalog/assets?kind=${k}`} className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", kind === k ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}>{k.replace("_", " ")}</Link>
          ))}
        </div>
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <span className="truncate text-[12px]">{a.title}</span>
                <span className="shrink-0 rounded border border-line px-1 py-0.5 font-mono text-[9px] text-ink-muted">{a.kind}</span>
                {a.tags.map((t) => <span key={t} className="shrink-0 font-mono text-[9px] text-ink-faint">#{t}</span>)}
              </span>
              <a href={a.blobUrl} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[10px] text-accent hover:underline">open →</a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
