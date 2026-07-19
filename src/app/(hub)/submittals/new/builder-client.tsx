"use client";

/**
 * Submittal builder (WO-14 task 5): pick project → pick products → agent
 * proposes → review composition (per-section doc checklist; required kinds
 * locked, optional editable; cover-sheet fields editable) → deterministic
 * assemble → approval queued. Escalation names the product + missing kind
 * with the resolution options.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, FolderCheck, Loader2, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, Mono } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SubmittalComposition } from "@/lib/submittals";
import { assembleSubmittal, proposeSubmittal } from "../actions";

const REQUIRED = new Set(["pds", "install"]);

type ReviewPhase = { name: "review"; busy: boolean; runId: string; approvalId: string; composition: SubmittalComposition };
type Phase =
  | { name: "pick" }
  | { name: "proposing" }
  | ReviewPhase
  | { name: "escalated"; reason: string; detail: Record<string, unknown> }
  | { name: "error"; message: string };

export function SubmittalBuilderClient({
  projects,
  products,
  prefill,
}: {
  projects: { id: string; name: string; accountName: string }[];
  products: { id: string; sku: string; name: string; family: string }[];
  prefill?: { packageId: string; projectId: string; productIds: string[]; sourceEmailId?: string };
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>(prefill?.projectId ?? projects[0]?.id ?? "");
  const [productIds, setProductIds] = useState<string[]>(prefill?.productIds ?? []);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "pick" });

  const filtered = useMemo(
    () => products.filter((p) => (p.sku + p.name).toLowerCase().includes(query.toLowerCase())).slice(0, 24),
    [products, query],
  );
  const selected = products.filter((p) => productIds.includes(p.id));

  const propose = async () => {
    setPhase({ name: "proposing" });
    const res = await proposeSubmittal({ projectId, productIds, sourceEmailId: prefill?.sourceEmailId });
    if (res.status === "proposed") {
      setPhase({ name: "review", busy: false, runId: res.runId, approvalId: res.approvalId, composition: res.composition });
    } else if (res.status === "escalated") {
      setPhase({ name: "escalated", reason: res.reason, detail: res.detail });
    } else {
      setPhase({ name: "error", message: res.error });
    }
  };

  const assemble = async (p: ReviewPhase) => {
    setPhase({ ...p, busy: true });
    const res = await assembleSubmittal({
      approvalId: p.approvalId,
      composition: p.composition,
      sourceEmailId: prefill?.sourceEmailId,
      packageId: prefill?.packageId,
    });
    if (res.ok) router.push(`/submittals/${res.packageId}`);
    else setPhase({ name: "error", message: res.error });
  };

  const toggleDoc = (p: ReviewPhase, sectionIdx: number, docIdx: number) => {
    const section = p.composition.sections[sectionIdx]!;
    const doc = section.docs[docIdx]!;
    if (REQUIRED.has(doc.kind)) return; // required kinds are locked
    const docs = section.docs.filter((_, i) => i !== docIdx);
    setPhase({
      ...p,
      composition: {
        ...p.composition,
        sections: p.composition.sections.map((s, i) => (i === sectionIdx ? { ...s, docs } : s)),
      },
    });
  };

  const setCoverField = (p: ReviewPhase, key: string, value: string) => {
    setPhase({ ...p, composition: { ...p.composition, coverSheet: { ...p.composition.coverSheet, [key]: value } } });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/submittals" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-ink-muted" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">New submittal package</h1>
          {prefill ? (
            <p className="font-mono text-[10px] text-warn">
              <Sparkles className="mr-1 inline h-3 w-3" />
              prepared overnight from the request email — review and compose
            </p>
          ) : null}
        </div>
      </div>

      {(phase.name === "pick" || phase.name === "proposing" || phase.name === "escalated" || phase.name === "error") && (
        <>
          <Card>
            <CardHeader n="01" title="Project" />
            <div className="p-3">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.accountName}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card>
            <CardHeader n="02" title={`Products (${productIds.length} selected)`} />
            <div className="p-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search finishes…"
                className="mb-2 w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
              />
              <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setProductIds((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))
                    }
                    className={cn(
                      "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-[12px]",
                      productIds.includes(p.id) ? "border-accent text-ink" : "border-line text-ink-muted hover:border-line-strong",
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    <Mono className="ml-2 shrink-0 text-[9px] text-ink-faint">{p.sku}</Mono>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {phase.name === "escalated" ? (
            <Card className="border-warn/40 bg-warn-dim p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-warn">
                <AlertTriangle className="h-4 w-4" /> Grounded or it escalates — {phase.reason}
              </p>
              <p className="mt-1.5 font-mono text-[11px] text-ink-muted">
                {String(phase.detail.productName ?? phase.detail.sku ?? "a product")} is missing its required{" "}
                {String(phase.detail.missingKind ?? "document")} — it is never silently omitted from a compliance
                package.
              </p>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Options: proceed without (architect risk) · remove the product from the package · upload the document.
                The escalation is also in the <Link href="/approvals" className="text-accent underline-offset-2 hover:underline">approval queue</Link>.
              </p>
            </Card>
          ) : null}
          {phase.name === "error" ? <p className="text-[12px] text-danger">{phase.message}</p> : null}

          <Button
            variant="primary"
            onClick={() => void propose()}
            disabled={phase.name === "proposing" || !projectId || productIds.length === 0}
            className="min-h-[44px]"
          >
            {phase.name === "proposing" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Composing from the document library…
              </>
            ) : (
              <>
                <FolderCheck className="h-3.5 w-3.5" /> Propose composition
              </>
            )}
          </Button>
          {selected.length > 0 && phase.name === "pick" ? (
            <Mono className="block text-[10px] text-ink-faint">
              {selected.map((s) => s.sku).join(" · ")} — pds + install required per product; test reports and
              warranties included when on file
            </Mono>
          ) : null}
        </>
      )}

      {phase.name === "review" && (
        <>
          <Card>
            <CardHeader n="03" title="Cover sheet" />
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {(
                [
                  ["packageTitle", "Package title"],
                  ["projectName", "Project"],
                  ["projectAddress", "Address"],
                  ["gcName", "General contractor"],
                  ["architectName", "Architect"],
                  ["repName", "Prepared by"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{label}</span>
                  <input
                    value={phase.composition.coverSheet[key]}
                    onChange={(e) => setCoverField(phase, key, e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[12px] outline-none focus:border-accent"
                  />
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader n="04" title="Sections — every included document is listed; required kinds are locked" />
            <div className="space-y-3 p-3">
              {phase.composition.sections.map((s, si) => (
                <div key={s.productId} className="rounded-md border border-line p-3">
                  <p className="text-[13px] font-medium">
                    {si + 1}. {s.productName} <Mono className="text-[10px] text-ink-faint">{s.sku}</Mono>
                  </p>
                  <div className="mt-2 space-y-1">
                    {s.docs.map((d, di) => (
                      <label key={d.pdsDocumentId} className="flex items-center gap-2 text-[12px]">
                        <input
                          type="checkbox"
                          checked
                          disabled={REQUIRED.has(d.kind) || phase.busy}
                          onChange={() => toggleDoc(phase, si, di)}
                        />
                        <span className="text-ink-muted">{d.title}</span>
                        <Mono className={cn("text-[9px]", REQUIRED.has(d.kind) ? "text-accent" : "text-ink-faint")}>
                          {d.kind}
                          {REQUIRED.has(d.kind) ? " · required" : ""}
                        </Mono>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {phase.composition.sampleRequestNote ? (
                <p className="rounded-md border border-accent/30 bg-accent-dim p-2.5 text-[11px] text-ink-muted">
                  {phase.composition.sampleRequestNote}
                </p>
              ) : null}
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => void assemble(phase)}
              disabled={phase.busy}
              className="min-h-[44px]"
            >
              {phase.busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Assembling — cover, TOC, dividers, page stamps…
                </>
              ) : (
                <>
                  <FolderCheck className="h-3.5 w-3.5" /> Assemble &amp; queue for approval
                </>
              )}
            </Button>
            <Mono className="text-[10px] text-ink-faint">deterministic pdf-lib assembly — no model in this step</Mono>
          </div>
        </>
      )}
    </div>
  );
}
