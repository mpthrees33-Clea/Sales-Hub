/** Submittal packages list (WO-14 task 5). */
import Link from "next/link";
import { FolderCheck } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, submittalPackages } from "@/db/schema";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { formatDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "accent" | "muted" | "danger"> = {
  approved: "ok",
  pending_approval: "accent",
  escalated: "warn",
  rejected: "danger",
  draft: "muted",
};

export default async function Page() {
  const rows = await db
    .select({
      id: submittalPackages.id,
      name: submittalPackages.name,
      number: submittalPackages.submittalNumber,
      status: submittalPackages.status,
      productIds: submittalPackages.productIds,
      createdAt: submittalPackages.createdAt,
      projectName: projects.name,
    })
    .from(submittalPackages)
    .leftJoin(projects, eq(projects.id, submittalPackages.projectId))
    .orderBy(desc(submittalPackages.createdAt));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Submittals</h1>
        <Link href="/submittals/new" className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90">New package</Link>
      </div>
      <Card>
        <CardHeader title="Packages" right={<span className="font-mono text-[10px] text-ink-faint">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={FolderCheck} title="No submittal packages" copy="Eight hours of document assembly compressed to minutes — cover sheet, TOC, dividers, page stamps." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <Link href={`/submittals/${s.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{s.name}</span>
                  <span className="block truncate font-mono text-[10px] text-ink-faint">{s.projectName ?? ""} · {s.productIds.length} products · {s.number ?? "—"}</span>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill tone={TONE[s.status] ?? "muted"}>{s.status.replace("_", " ")}</StatusPill>
                  <span className="font-mono text-[10px] text-ink-faint">{formatDateShort(s.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
