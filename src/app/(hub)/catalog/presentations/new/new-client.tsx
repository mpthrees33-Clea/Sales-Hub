"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Card, CardHeader, Mono } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createPresentation } from "../actions";

export function NewPresentationClient({
  products,
}: {
  products: { id: string; sku: string; name: string; family: string; swatch: string | null }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Spring line — client presentation");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    const res = await createPresentation({ title, productIds: picked });
    setBusy(false);
    if (res.ok) router.push(`/catalog/presentations/${res.presentationId}/present`);
    else setError(res.error);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/catalog/presentations" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-ink-muted" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">New presentation</h1>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
      />
      <Card>
        <CardHeader n="01" title={`Pick products — ${picked.length} selected (slides auto-compose)`} />
        <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-4 lg:grid-cols-6">
          {products.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPicked((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                className={cn(
                  "overflow-hidden rounded-md border text-left transition-colors",
                  on ? "border-accent" : "border-line hover:border-line-strong",
                )}
              >
                {p.swatch ? (
                  <Image src={p.swatch} alt={p.name} width={160} height={80} unoptimized className="h-14 w-full object-cover" />
                ) : (
                  <div className="h-14 w-full bg-surface2" />
                )}
                <div className="p-1.5">
                  <Mono className="text-[9px] text-ink-faint">{p.sku}</Mono>
                  <p className="truncate text-[11px]">{p.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => void submit()} disabled={busy || picked.length === 0 || !title}>
          {busy ? "Composing slides…" : "Compose deck"}
        </Button>
        {error ? <span className="text-[11px] text-danger">{error}</span> : null}
      </div>
    </div>
  );
}
