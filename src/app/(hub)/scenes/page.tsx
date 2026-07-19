import Link from "next/link";
import Image from "next/image";
import { desc, eq } from "drizzle-orm";
import { Image as ImageIcon, Plus } from "lucide-react";
import { db } from "@/db/client";
import { products, roomScenes } from "@/db/schema";
import { Card, EmptyState, Mono, StatusPill } from "@/components/ui";
import { formatDurationMs } from "@/lib/dates";
import { sceneBudget } from "@/lib/scene-limits";

export const dynamic = "force-dynamic";

export default async function ScenesPage() {
  const [rows, budget] = await Promise.all([
    db
      .select({ scene: roomScenes, productName: products.name, sku: products.sku })
      .from(roomScenes)
      .innerJoin(products, eq(products.id, roomScenes.productId))
      .orderBy(desc(roomScenes.createdAt))
      .limit(30),
    sceneBudget(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Room scenes</h1>
          <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
            user-triggered · {budget.usedToday}/{budget.cap} today · ~${budget.estimatedCostUsd.toFixed(2)}/image · no
            batch agent can reach generation
          </p>
        </div>
        <Link
          href="/scenes/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Generate a scene
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ImageIcon}
            title="No room scenes yet"
            copy="Pick a finish, pick a room photo, and generate a photoreal applied scene — then attach it to a reply through the asset library."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ scene, productName, sku }) => (
            <Link key={scene.id} href={`/scenes/${scene.id}`}>
              <Card className="overflow-hidden transition-colors hover:border-line-strong">
                {scene.outputBlobUrl ? (
                  <Image
                    src={scene.outputBlobUrl}
                    alt={`${productName} scene`}
                    width={640}
                    height={360}
                    unoptimized
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-surface2">
                    <StatusPill tone={scene.status === "failed" ? "danger" : "accent"}>{scene.status}</StatusPill>
                  </div>
                )}
                <div className="flex items-center justify-between p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium">{productName}</p>
                    <Mono className="text-[9px] text-ink-faint">
                      {sku} · {scene.targetSurfaces.join(", ")}
                    </Mono>
                  </div>
                  {scene.durationMs ? (
                    <span className="shrink-0 font-mono text-[9px] text-ink-faint">{formatDurationMs(scene.durationMs)}</span>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
