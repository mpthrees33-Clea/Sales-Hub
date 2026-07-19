/** Scene detail (WO-11 tasks 5–6) — before/after slider, metadata, register-as-asset. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, products, roomScenes } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { formatDateTime, formatDurationMs } from "@/lib/dates";
import { RegisterAssetButton } from "./register-button";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scene = await db.query.roomScenes.findFirst({ where: eq(roomScenes.id, id) });
  if (!scene) notFound();
  const product = await db.query.products.findFirst({ where: eq(products.id, scene.productId) });
  const registered = scene.outputBlobUrl
    ? (await db.select({ id: assets.id }).from(assets).where(and(eq(assets.kind, "scene"), eq(assets.blobUrl, scene.outputBlobUrl))).limit(1)).length > 0
    : false;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/scenes" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> scenes</Link>
          <h1 className="text-lg font-semibold tracking-tight">{product?.name ?? "Room scene"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/scenes/new?sku=${product?.sku ?? ""}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><RefreshCw className="h-3.5 w-3.5" /> regenerate</Link>
          <RegisterAssetButton sceneId={scene.id} initiallyRegistered={registered} disabled={!scene.outputBlobUrl} />
        </div>
      </div>

      <Card className="p-3">
        {scene.outputBlobUrl ? (
          <BeforeAfterSlider beforeUrl={scene.sourcePhotoBlobUrl} afterUrl={scene.outputBlobUrl} />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-line bg-surface2 font-mono text-[11px] text-danger">generation did not complete</div>
        )}
      </Card>

      <Card>
        <CardHeader title="Details" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
          <Field label="Product" value={`${product?.name ?? "—"} · ${product?.sku ?? ""}`} />
          <Field label="Surfaces" value={scene.targetSurfaces.join(", ")} />
          <Field label="Model" value={scene.model ?? "—"} mono />
          <Field label="Duration" value={scene.durationMs ? formatDurationMs(scene.durationMs) : "—"} mono />
          <Field label="Created" value={formatDateTime(scene.createdAt)} mono />
          <Field label="Status" value={scene.status} mono />
        </dl>
        <div className="border-t border-line px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">prompt</span>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{scene.prompt}</p>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className={mono ? "font-mono text-[11px]" : "text-[12px] font-medium"}>{value}</dd>
    </div>
  );
}
