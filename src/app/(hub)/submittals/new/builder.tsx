"use client";

/**
 * Submittal builder (WO-14 task 5). Pick a project, multi-select products, and
 * run the agent. On success it routes to the created approval (the package is
 * assembled and filed for the human to send). On escalation it names exactly
 * which document is missing for which product — never a silent omission.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, FolderCheck, Loader2, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { runSubmittalAction, type SubmittalRunResult } from "../actions";

type Project = { id: string; name: string; gcName: string | null; architectName: string | null };
type Product = { id: string; sku: string; name: string; family: string };

export function SubmittalBuilder({
  projects,
  catalog,
  preselectProjectId,
  preselectProductIds,
  sourceSubject,
}: {
  projects: Project[];
  catalog: Product[];
  preselectProjectId: string | null;
  preselectProductIds: string[];
  sourceSubject: string | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(preselectProjectId);
  const [picked, setPicked] = useState<string[]>(preselectProductIds);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SubmittalRunResult | null>(null);
  const [pending, startTransition] = useTransition();

  const project = projects.find((p) => p.id === projectId) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? catalog.filter((p) => `${p.name} ${p.sku} ${p.family}`.toLowerCase().includes(q)) : catalog;
  }, [catalog, query]);

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const assemble = () =>
    startTransition(async () => {
      setResult(null);
      if (!projectId || picked.length === 0) return;
      const r = await runSubmittalAction(projectId, picked);
      setResult(r);
      if (r.status === "succeeded" && r.approvalId) router.push(`/approvals?focus=${r.approvalId}`);
    });

  const missing = result?.escalation?.reason === "missing_document" ? (result.escalation.detail as { sku?: string; productName?: string; missing?: string[] }) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/submittals" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> submittals</Link>
        <h1 className="text-lg font-semibold tracking-tight">New submittal package</h1>
      </div>
      {sourceSubject ? <p className="font-mono text-[11px] text-ink-faint">From request: “{sourceSubject}”</p> : null}

      {/* Project */}
      <Card>
        <CardHeader title="1 · Project" right={project ? <span className="font-mono text-[10px] text-accent">selected</span> : null} />
        <ul className="max-h-52 divide-y divide-line overflow-y-auto">
          {projects.map((p) => {
            const on = p.id === projectId;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => setProjectId(p.id)} className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>{on ? <Check className="h-3 w-3" /> : null}</span>
                    <span className="truncate text-[12px] font-medium">{p.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint">{p.gcName ?? p.architectName ?? ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader title="2 · Products" right={<span className="font-mono text-[10px] text-ink-faint">{picked.length} selected</span>} />
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <Search className="h-3.5 w-3.5 text-ink-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name, SKU, family" className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint" />
        </div>
        <ul className="max-h-64 divide-y divide-line overflow-y-auto">
          {filtered.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => toggle(p.id)} className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>{on ? <Check className="h-3 w-3" /> : null}</span>
                    <span className="truncate text-[12px] font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">{p.sku}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-muted">{p.family}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {missing ? (
        <Card className="border-warn/40 bg-warn-dim p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div className="text-[12px]">
              <p className="font-medium text-warn">Missing required document — escalated, nothing assembled.</p>
              <p className="mt-1 text-ink-muted">{missing.productName} ({missing.sku}) is missing: <span className="font-mono">{(missing.missing ?? []).join(", ")}</span>. Remove the product, or upload the document in the catalog, then rerun.</p>
            </div>
          </div>
        </Card>
      ) : null}
      {result?.status === "failed" ? <p className="text-center font-mono text-[11px] text-danger">Assembly failed. Try again.</p> : null}

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-faint"><FolderCheck className="mr-1 inline h-3 w-3" /> Cover sheet + TOC + per-product dividers + docs, page-stamped.</span>
        <button type="button" onClick={assemble} disabled={pending || !projectId || picked.length === 0} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink hover:opacity-90 disabled:opacity-50">
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Assembling…</> : <>Assemble package ({picked.length})</>}
        </button>
      </div>
    </div>
  );
}
