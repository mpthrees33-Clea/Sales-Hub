/** Room-scene gallery (WO-11 task 5). Seed ships 2 hero scenes so this is never empty. */
import Link from "next/link";
import { Image as ImageIcon, Sparkles } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products, roomScenes } from "@/db/schema";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { formatDateShort } from "@/lib/dates";
import { sceneQuota, SCENE_COST_USD } from "@/lib/scene-limits";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db
    .select({
      id: roomScenes.id,
      productName: products.name,
      sku: products.sku,
      sourcePhotoBlobUrl: roomScenes.sourcePhotoBlobUrl,
      outputBlobUrl: roomScenes.outputBlobUrl,
      surfaces: roomScenes.targetSurfaces,
      status: roomScenes.status,
      createdAt: roomScenes.createdAt,
    })
    .from(roomScenes)
    .innerJoin(products, eq(products.id, roomScenes.productId))
    .orderBy(desc(roomScenes.createdAt));
  const quota = await sceneQuota();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Room Scenes</h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-ink-faint">{quota.used}/{quota.cap} today · ~${SCENE_COST_USD.toFixed(2)}/image</span>
          <Link href="/scenes/new" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90"><Sparkles className="h-3.5 w-3.5" /> New scene</Link>
        </div>
      </div>

      <Card>
        <CardHeader title="Gallery" right={<span className="font-mono text-[10px] text-ink-faint">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={ImageIcon} title="No room scenes yet" copy="Pick a finish, pick a room photo, and generate a photoreal applied scene." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
            {rows.map((s) => (
              <li key={s.id}>
                <Link href={`/scenes/${s.id}`} className="group block overflow-hidden rounded-lg border border-line bg-surface2 transition-colors hover:border-line-strong">
                  <div className="aspect-[16/10] w-full overflow-hidden bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.outputBlobUrl ? <img src={s.outputBlobUrl} alt={`${s.productName} scene`} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" /> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-medium">{s.productName}</span>
                      <span className="block truncate font-mono text-[10px] text-ink-faint">{s.surfaces.join(", ")}</span>
                    </span>
                    {s.status === "complete" ? <StatusPill tone="ok">done</StatusPill> : <StatusPill tone="muted">{s.status}</StatusPill>}
                  </div>
                  <div className="px-2.5 pb-2 font-mono text-[9px] text-ink-faint">{formatDateShort(s.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
