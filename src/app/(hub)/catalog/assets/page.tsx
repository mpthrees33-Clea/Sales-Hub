import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { assets } from "@/db/schema";
import { Card, CardHeader, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PdfPreviewLink } from "../_components/pdf-preview";
import { AssetUpload } from "./upload-client";

export const dynamic = "force-dynamic";

/** Marketing asset library (WO-10 task 4) — the attachment source of record. */
export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const rows = await db.select().from(assets).orderBy(desc(assets.createdAt));
  const allTags = [...new Set(rows.flatMap((r) => r.tags))].sort();
  const filtered = tag ? rows.filter((r) => r.tags.includes(tag)) : rows;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Marketing assets</h1>
        <Link href="/catalog" className="font-mono text-[11px] text-ink-muted hover:text-ink">
          ← Catalog
        </Link>
      </div>
      <AssetUpload />
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/catalog/assets"
          className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px]", !tag ? "border-accent text-accent" : "border-line text-ink-muted")}
        >
          all
        </Link>
        {allTags.map((t) => (
          <Link
            key={t}
            href={`/catalog/assets?tag=${t}`}
            className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px]", tag === t ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}
          >
            {t}
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader
          n="01"
          title={`${filtered.length} assets — the only legal source of email attachments hub-wide`}
        />
        <ul className="divide-y divide-line">
          {filtered.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 px-4 py-2">
              <StatusPill tone="muted">{a.kind}</StatusPill>
              <span className="min-w-0 flex-1 truncate text-[12px]">{a.title}</span>
              <span className="hidden font-mono text-[9px] text-ink-faint sm:block">{a.tags.join(" · ")}</span>
              {a.contentType === "application/pdf" ? (
                <PdfPreviewLink url={a.blobUrl} title={a.title} />
              ) : (
                <a href={a.blobUrl} target="_blank" className="font-mono text-[10px] text-accent hover:opacity-80">
                  open
                </a>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
