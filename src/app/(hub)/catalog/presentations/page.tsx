import Link from "next/link";
import { desc } from "drizzle-orm";
import { Presentation } from "lucide-react";
import { db } from "@/db/client";
import { presentations } from "@/db/schema";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { formatDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PresentationsPage() {
  const rows = await db.select().from(presentations).orderBy(desc(presentations.createdAt));
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Presentations</h1>
        <div className="flex items-center gap-3">
          <Link href="/catalog/presentations/new" className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90">
            New presentation
          </Link>
          <Link href="/catalog" className="font-mono text-[11px] text-ink-muted hover:text-ink">
            ← Catalog
          </Link>
        </div>
      </div>
      <Card>
        <CardHeader n="01" title="Decks" />
        {rows.length === 0 ? (
          <EmptyState
            icon={Presentation}
            title="No presentations yet"
            copy="Pick products and the builder composes clean slides — present in-app or export a PDF that becomes an attachable asset."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.title}</span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {p.slides.length} slides · {formatDateShort(p.createdAt)}
                </span>
                <StatusPill tone={p.status === "ready" ? "ok" : "muted"}>{p.status}</StatusPill>
                <Link href={`/catalog/presentations/${p.id}/present`} className="font-mono text-[11px] text-accent hover:opacity-80">
                  present →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
