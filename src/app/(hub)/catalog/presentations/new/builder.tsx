"use client";

/** New-presentation builder (WO-10 task 5) — multi-select products, auto-compose slides. */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createPresentationAction } from "../actions";

type CatalogRow = { id: string; sku: string; name: string; family: string };

export function NewPresentation({ catalog }: { catalog: CatalogRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) => `${p.name} ${p.sku} ${p.family}`.toLowerCase().includes(q));
  }, [catalog, query]);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = () =>
    startTransition(async () => {
      const { id } = await createPresentationAction(title, picked);
      router.push(`/catalog/presentations/${id}/present`);
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/catalog/presentations" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> presentations</Link>
        <h1 className="text-lg font-semibold tracking-tight">New presentation</h1>
      </div>

      <Card className="p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Deck title — e.g. Harborview Lobby Selection"
          className="w-full rounded-md border border-line bg-surface2 px-3 py-2 text-[13px] outline-none focus:border-accent"
        />
      </Card>

      <Card>
        <CardHeader title="Products" right={<span className="font-mono text-[10px] text-ink-faint">{picked.length} selected</span>} />
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <Search className="h-3.5 w-3.5 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, SKU, or family"
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
          />
        </div>
        <ul className="max-h-[52vh] divide-y divide-line overflow-y-auto">
          {filtered.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="truncate text-[12px] font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">{p.sku}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-muted">{p.family}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? <li className="px-4 py-6 text-center font-mono text-[11px] text-ink-faint">no matches</li> : null}
        </ul>
      </Card>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-faint">Slides auto-compose: a title, one per product, and your closing card.</span>
        <button
          type="button"
          onClick={create}
          disabled={pending || picked.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Build deck ({picked.length})
        </button>
      </div>
    </div>
  );
}
