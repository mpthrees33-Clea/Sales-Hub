"use client";

/**
 * Scene studio (WO-11 task 4). Three steps — product, room, surfaces — then a
 * capped, cost-visible generate. Generation runs server-side (agent composes
 * the request, provider renders); the button shows a live progress state and
 * never spins forever (failures surface as an inline error).
 */
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Sparkles, Upload } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { generateSceneAction } from "../actions";

type CatalogRow = { id: string; sku: string; name: string; family: string; finish: string; swatchBlobUrl: string | null };
type Room = { label: string; blobUrl: string };

const SURFACES = ["feature wall", "reception desk", "column wraps", "door panels", "ceiling"];

export function Studio({
  catalog,
  rooms,
  preselectProductId,
  quota,
  costUsd,
}: {
  catalog: CatalogRow[];
  rooms: Room[];
  preselectProductId: string | null;
  quota: { used: number; cap: number; capReached: boolean };
  costUsd: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [productId, setProductId] = useState<string | null>(preselectProductId);
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState<string | null>(rooms[0]?.blobUrl ?? null);
  const [uploadedRoom, setUploadedRoom] = useState<{ label: string; blobUrl: string } | null>(null);
  const [surfaces, setSurfaces] = useState<string[]>(["feature wall"]);
  const [styleNote, setStyleNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const allRooms = uploadedRoom ? [...rooms, uploadedRoom] : rooms;
  const product = catalog.find((c) => c.id === productId) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? catalog.filter((p) => `${p.name} ${p.sku} ${p.family} ${p.finish}`.toLowerCase().includes(q)) : catalog;
  }, [catalog, query]);

  const swatch = (p: CatalogRow) => p.swatchBlobUrl ?? `/api/blob/swatches/${p.sku}.svg`;
  const toggleSurface = (s: string) => setSurfaces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const uploadRoom = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/rooms", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "upload failed");
      setUploadedRoom({ label: file.name, blobUrl: json.blobUrl });
      setRoom(json.blobUrl);
    } finally {
      setUploading(false);
    }
  };

  const ready = Boolean(productId && room && surfaces.length && !quota.capReached);
  const generate = () =>
    startTransition(async () => {
      setError(null);
      if (!productId || !room) return;
      try {
        const { sceneId } = await generateSceneAction({ productId, roomPhotoBlobUrl: room, targetSurfaces: surfaces, styleNote: styleNote.trim() || undefined });
        router.push(`/scenes/${sceneId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "generation failed");
      }
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/scenes" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> scenes</Link>
        <h1 className="text-lg font-semibold tracking-tight">New room scene</h1>
      </div>

      {/* Step 1 — product */}
      <Card>
        <CardHeader title="1 · Finish" right={product ? <span className="font-mono text-[10px] text-accent">{product.sku}</span> : null} />
        <div className="border-b border-line px-4 py-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search finish by name, SKU, family" className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint" />
        </div>
        <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
          {filtered.map((p) => {
            const on = p.id === productId;
            return (
              <button key={p.id} type="button" onClick={() => setProductId(p.id)} className={cn("flex items-center gap-2 rounded-md border p-1.5 text-left", on ? "border-accent bg-accent-dim" : "border-line hover:border-line-strong")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={swatch(p)} alt="" className="h-9 w-9 shrink-0 rounded border border-line object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium">{p.name}</span>
                  <span className="block truncate font-mono text-[9px] text-ink-faint">{p.finish}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Step 2 — room */}
      <Card>
        <CardHeader title="2 · Room photo" right={<button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 font-mono text-[10px] text-accent hover:underline disabled:opacity-50">{uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} upload</button>} />
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
          {allRooms.map((r) => {
            const on = r.blobUrl === room;
            return (
              <button key={r.blobUrl} type="button" onClick={() => setRoom(r.blobUrl)} className={cn("overflow-hidden rounded-md border text-left", on ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong")}>
                <div className="aspect-[16/10] w-full bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.blobUrl} alt={r.label} className="h-full w-full object-cover" />
                </div>
                <span className="block truncate px-2 py-1 text-[11px]">{r.label}</span>
              </button>
            );
          })}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadRoom(f); }} />
      </Card>

      {/* Step 3 — surfaces */}
      <Card>
        <CardHeader title="3 · Target surfaces" />
        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {SURFACES.map((s) => {
            const on = surfaces.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleSurface(s)} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]", on ? "border-accent bg-accent-dim text-accent" : "border-line text-ink-muted hover:text-ink")}>
                {on ? <Check className="h-3 w-3" /> : null}{s}
              </button>
            );
          })}
        </div>
        <div className="border-t border-line px-4 py-2">
          <input value={styleNote} onChange={(e) => setStyleNote(e.target.value)} placeholder="Optional style note — e.g. warm evening light" className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint" />
        </div>
      </Card>

      {/* Generate */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-ink-faint">
          {quota.capReached ? `Daily cap reached (${quota.used}/${quota.cap}). Resets next demo day.` : `Est. ~$${costUsd.toFixed(2)} · ${quota.used}/${quota.cap} used today`}
        </span>
        <button type="button" onClick={generate} disabled={!ready || pending} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink hover:opacity-90 disabled:opacity-50">
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate scene</>}
        </button>
      </div>
      {pending ? <p className="text-center font-mono text-[10px] text-ink-faint">Applying the finish to the {surfaces.join(", ")} — this takes a few seconds.</p> : null}
      {error ? <p className="text-center font-mono text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
