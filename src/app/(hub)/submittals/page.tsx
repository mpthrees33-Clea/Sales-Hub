import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { FolderCheck, Plus, Sparkles } from "lucide-react";
import { db } from "@/db/client";
import { projects, submittalPackages } from "@/db/schema";
import { Card, EmptyState, Mono, StatusPill } from "@/components/ui";
import { formatDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "accent" | "warn" | "danger" | "muted"> = {
  approved: "ok",
  pending_approval: "accent",
  draft: "warn",
  escalated: "warn",
  rejected: "danger",
};

export default async function SubmittalsPage() {
  const rows = await db
    .select({ pkg: submittalPackages, projectName: projects.name })
    .from(submittalPackages)
    .innerJoin(projects, eq(projects.id, submittalPackages.projectId))
    .orderBy(desc(submittalPackages.createdAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Submittals</h1>
          <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
            8–12 hours of document assembly → minutes · composition proposed, assembly deterministic
          </p>
        </div>
        <Link
          href="/submittals/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> New package
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderCheck}
            title="No submittal packages"
            copy="Eight hours of document assembly compressed to minutes — cover sheet, TOC, dividers, page stamps."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ pkg, projectName }) => (
            <Link
              key={pkg.id}
              href={pkg.status === "draft" ? `/submittals/new?package=${pkg.id}` : `/submittals/${pkg.id}`}
              className="block"
            >
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-line-strong">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    {pkg.status === "draft" ? <Sparkles className="h-3.5 w-3.5 text-warn" /> : null}
                    {pkg.name}
                  </p>
                  <Mono className="text-[10px] text-ink-faint">
                    {projectName} · {pkg.productIds.length} products
                    {pkg.submittalNumber ? ` · ${pkg.submittalNumber}` : ""} · {formatDateShort(pkg.createdAt)}
                    {pkg.status === "draft" ? " · prepared overnight — open the builder" : ""}
                  </Mono>
                </div>
                <StatusPill tone={TONE[pkg.status] ?? "muted"}>{pkg.status.replace("_", " ")}</StatusPill>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
