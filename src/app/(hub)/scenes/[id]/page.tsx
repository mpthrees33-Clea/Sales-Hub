import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { products, roomScenes } from "@/db/schema";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { Card, CardHeader, Mono, StatusPill } from "@/components/ui";
import { formatDurationMs } from "@/lib/dates";
import { SceneActions } from "./scene-actions";

export const dynamic = "force-dynamic";

export default async function SceneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scene = await db.query.roomScenes.findFirst({ where: eq(roomScenes.id, id) });
  if (!scene) notFound();
  const product = await db.query.products.findFirst({ where: eq(products.id, scene.productId) });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/scenes" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-ink-muted" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{product?.name ?? "Scene"}</h1>
            <Mono className="text-[10px] text-ink-faint">
              {product?.sku} · {scene.targetSurfaces.join(", ")}
            </Mono>
          </div>
        </div>
        <StatusPill tone={scene.status === "complete" ? "ok" : scene.status === "failed" ? "danger" : "accent"}>
          {scene.status}
        </StatusPill>
      </div>

      {scene.outputBlobUrl ? (
        <BeforeAfterSlider beforeUrl={scene.sourcePhotoBlobUrl} afterUrl={scene.outputBlobUrl} alt={product?.name ?? "scene"} />
      ) : (
        <Card className="p-8 text-center text-[12px] text-ink-muted">No output — generation failed or is still running.</Card>
      )}

      <SceneActions sceneId={scene.id} productId={scene.productId} hasOutput={Boolean(scene.outputBlobUrl)} />

      <Card>
        <CardHeader n="01" title="Generation detail" />
        <dl className="space-y-1.5 p-4 text-[12px]">
          <Row k="Model" v={<Mono>{scene.model ?? "—"}</Mono>} />
          <Row k="Duration" v={scene.durationMs ? formatDurationMs(scene.durationMs) : "—"} />
          <Row k="Surfaces" v={scene.targetSurfaces.join(", ")} />
          <Row k="Prompt" v={<span className="text-ink-muted">{scene.prompt}</span>} />
        </dl>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line pb-1.5 last:border-0">
      <dt className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">{k}</dt>
      <dd className="min-w-0">{v}</dd>
    </div>
  );
}
