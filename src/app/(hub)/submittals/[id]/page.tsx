/** Submittal package detail (WO-14 task 5) — composition + assembled PDF. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, submittalPackages } from "@/db/schema";
import { Card, CardHeader, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "accent" | "muted" | "danger"> = { approved: "ok", pending_approval: "accent", escalated: "warn", rejected: "danger", draft: "muted" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pkg = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.id, id) });
  if (!pkg) notFound();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, pkg.projectId) });
  const cover = (pkg.coverSheet ?? {}) as Record<string, string>;
  const sections = pkg.sections ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/submittals" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> submittals</Link>
          <h1 className="text-lg font-semibold tracking-tight">{pkg.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill tone={TONE[pkg.status] ?? "muted"}>{pkg.status.replace("_", " ")}</StatusPill>
          {pkg.outputBlobUrl ? <a href={pkg.outputBlobUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-ink hover:opacity-90"><FileText className="h-3.5 w-3.5" /> Open PDF</a> : null}
        </div>
      </div>

      <Card>
        <CardHeader title="Cover sheet" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
          <Field label="Project" value={project?.name ?? cover.projectName ?? "—"} />
          <Field label="Submittal No." value={pkg.submittalNumber ?? cover.submittalNumber ?? "—"} mono />
          <Field label="General Contractor" value={cover.gcName ?? "—"} />
          <Field label="Architect" value={cover.architectName ?? "—"} />
          <Field label="Prepared by" value={cover.repName ?? "—"} />
          <Field label="Date" value={cover.date ?? "—"} mono />
        </dl>
      </Card>

      <Card>
        <CardHeader title="Contents" right={<span className="font-mono text-[10px] text-ink-faint">{sections.length} sections</span>} />
        <ol className="divide-y divide-line">
          {sections.map((s, i) => (
            <li key={s.productId} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[10px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate text-[13px] font-medium">{s.productName}</span>
                <span className="shrink-0 font-mono text-[10px] text-ink-faint">{s.sku}</span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-1">
                {s.docs.map((d) => <span key={d.pdsDocumentId} className="rounded border border-line px-1 py-0.5 font-mono text-[9px] text-ink-muted">{d.kind}</span>)}
                {s.startPage ? <span className="ml-1 font-mono text-[10px] text-ink-faint">p.{s.startPage}</span> : null}
              </span>
            </li>
          ))}
        </ol>
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
