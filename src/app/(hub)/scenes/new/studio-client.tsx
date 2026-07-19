"use client";

/**
 * Scene studio (WO-11 task 4): pick product (hero first) → pick room photo
 * (fixtures or upload) → target surfaces + style note → generate with
 * streaming progress. Cap + estimated cost visible before generating.
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import { Button, Card, CardHeader, Mono } from "@/components/ui";
import { cn } from "@/lib/utils";
import { generateScene } from "../actions";

const SURFACES = ["feature wall", "reception desk", "column wraps", "door panels", "ceiling"];

export function SceneStudioClient({
  products,
  fixtureRooms,
  budget,
  preselectedProductId,
}: {
  products: { id: string; sku: string; name: string; swatch: string | null }[];
  fixtureRooms: { key: string; label: string; url: string }[];
  budget: { usedToday: number; cap: number; remaining: number; estimatedCostUsd: number };
  preselectedProductId?: string;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState<string | null>(preselectedProductId ?? products[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [roomUrl, setRoomUrl] = useState<string | null>(fixtureRooms[0]?.url ?? null);
  const [surfaces, setSurfaces] = useState<string[]>(["feature wall"]);
  const [styleNote, setStyleNote] = useState("");
  const [state, setState] = useState<{ phase: "idle" | "running" | "error"; message?: string }>({ phase: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => products.filter((p) => (p.sku + p.name).toLowerCase().includes(query.toLowerCase())).slice(0, 18),
    [products, query],
  );
  const capReached = budget.remaining <= 0;

  const uploadRoom = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", `Room photo — ${file.name}`);
    form.append("tags", "room-photo");
    const res = await fetch("/api/demo/upload-asset", { method: "POST", body: form });
    const data = (await res.json()) as { blobUrl?: string; error?: string };
    if (res.ok && data.blobUrl) setRoomUrl(data.blobUrl);
    else setState({ phase: "error", message: data.error ?? "upload failed" });
  };

  const run = async () => {
    if (!productId || !roomUrl || surfaces.length === 0) return;
    setState({ phase: "running" });
    const res = await generateScene({
      productId,
      roomPhotoBlobUrl: roomUrl,
      targetSurfaces: surfaces,
      styleNote: styleNote || undefined,
    });
    if (res.ok) router.push(`/scenes/${res.sceneId}`);
    else setState({ phase: "error", message: res.error });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/scenes" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-ink-muted" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Scene studio</h1>
        </div>
        <span className="font-mono text-[10px] text-ink-faint">
          {budget.remaining}/{budget.cap} left today · ~${budget.estimatedCostUsd.toFixed(2)}/image
        </span>
      </div>

      <Card>
        <CardHeader n="01" title="Pick the finish" />
        <div className="p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search finishes…"
            className="mb-2 w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
          />
          <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-6">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductId(p.id)}
                className={cn(
                  "overflow-hidden rounded-md border text-left",
                  productId === p.id ? "border-accent" : "border-line hover:border-line-strong",
                )}
              >
                {p.swatch ? (
                  <Image src={p.swatch} alt={p.name} width={120} height={60} unoptimized className="h-12 w-full object-cover" />
                ) : (
                  <div className="h-12 w-full bg-surface2" />
                )}
                <div className="p-1">
                  <p className="truncate text-[10px]">{p.name}</p>
                  <Mono className="text-[8px] text-ink-faint">{p.sku}</Mono>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader n="02" title="Pick the room photo" />
        <div className="flex flex-wrap items-start gap-3 p-3">
          {fixtureRooms.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRoomUrl(r.url)}
              className={cn(
                "overflow-hidden rounded-md border",
                roomUrl === r.url ? "border-accent" : "border-line hover:border-line-strong",
              )}
            >
              <Image src={r.url} alt={r.label} width={220} height={124} unoptimized className="h-28 w-48 object-cover" />
              <p className="p-1.5 text-left text-[10px] text-ink-muted">{r.label}</p>
            </button>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadRoom(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex h-28 w-48 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-ink-muted",
              roomUrl && !fixtureRooms.some((r) => r.url === roomUrl) ? "border-accent" : "border-line hover:border-line-strong",
            )}
          >
            <Upload className="h-4 w-4" />
            Upload customer photo
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader n="03" title="Target surfaces" />
        <div className="space-y-2.5 p-3">
          <div className="flex flex-wrap gap-1.5">
            {SURFACES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSurfaces((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                  surfaces.includes(s) ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={styleNote}
            onChange={(e) => setStyleNote(e.target.value)}
            placeholder="Optional style note — e.g. 'warm evening lighting'"
            className="w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
          />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={() => void run()}
          disabled={state.phase === "running" || capReached || !productId || !roomUrl || surfaces.length === 0}
          className="min-h-[44px]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {state.phase === "running" ? "Generating…" : `Generate (~$${budget.estimatedCostUsd.toFixed(2)})`}
        </Button>
        {capReached ? (
          <span className="text-[11px] text-warn">
            Daily cap reached ({budget.cap}/day) — generation is deliberately budgeted.
          </span>
        ) : null}
        {state.phase === "running" ? (
          <span className="font-mono text-[11px] text-accent status-running">
            applying the finish · preserving lighting and geometry…
          </span>
        ) : null}
        {state.phase === "error" ? <span className="text-[11px] text-danger">{state.message}</span> : null}
      </div>
    </div>
  );
}
