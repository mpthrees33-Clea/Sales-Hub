import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { approvals, projects, submittalPackages } from "@/db/schema";
import { PdfViewer } from "@/components/pdf-viewer";
import { Card, CardHeader, Mono, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "accent" | "warn" | "danger" | "muted"> = {
  approved: "ok",
  pending_approval: "accent",
  draft: "warn",
  escalated: "warn",
  rejected: "danger",
};

export default async function SubmittalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pkg = await db.query.submittalPackages.findFirst({ where: eq(submittalPackages.id, id) });
  if (!pkg) notFound();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, pkg.projectId) });
  const approval = await db.query.approvals.findFirst({
    where: sql`${approvals.kind} = 'submittal' and ${approvals.proposedAction}->>'submittalPackageId' = ${pkg.id}`,
    orderBy: desc(approvals.createdAt),
  });
  const cover = (pkg.coverSheet ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/submittals" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-ink-muted" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{pkg.name}</h1>
            <Mono className="text-[10px] text-ink-faint">
              {project?.name}
              {pkg.submittalNumber ? ` · ${pkg.submittalNumber}` : ""} · {pkg.productIds.length} products
            </Mono>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={TONE[pkg.status] ?? "muted"}>{pkg.status.replace("_", " ")}</StatusPill>
          {approval?.status === "pending" ? (
            <Link
              href="/approvals"
              className="inline-flex items-center gap-1 text-[12px] text-accent transition-opacity hover:opacity-80"
            >
              Review in approvals <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader n="01" title="Cover sheet" />
            <dl className="space-y-1.5 p-4 text-[12px]">
              {(
                [
                  ["projectName", "Project"],
                  ["projectAddress", "Address"],
                  ["gcName", "GC"],
                  ["architectName", "Architect"],
                  ["repName", "Prepared by"],
                  ["date", "Date"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-baseline gap-3 border-b border-line pb-1.5 last:border-0">
                  <dt className="w-20 shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-faint">{label}</dt>
                  <dd className="min-w-0">{cover[key] ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader n="02" title="Contents" />
            <ol className="space-y-2 p-4">
              {(pkg.sections ?? []).map((s, i) => (
                <li key={s.productId} className="text-[12px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span>
                      <span className="font-mono text-[10px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>{" "}
                      <span className="font-medium">{s.productName}</span>{" "}
                      <Mono className="text-[10px] text-ink-muted">{s.sku}</Mono>
                    </span>
                    {s.startPage ? <Mono className="shrink-0 text-[10px] text-ink-faint">p. {s.startPage}</Mono> : null}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{s.docs.map((d) => d.kind).join(" · ")}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {pkg.outputBlobUrl ? (
            <Card className="p-3">
              <PdfViewer url={pkg.outputBlobUrl} />
            </Card>
          ) : (
            <Card className="p-8 text-center text-[12px] text-ink-muted">
              Not assembled yet —{" "}
              <Link href={`/submittals/new?package=${pkg.id}`} className="text-accent underline-offset-2 hover:underline">
                open the builder
              </Link>
              .
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
