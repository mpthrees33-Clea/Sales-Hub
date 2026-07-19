import Link from "next/link";
import { Mail, Paperclip } from "lucide-react";
import { Card, EmptyState, Mono, StatusPill } from "@/components/ui";
import { formatDateTime, relativeAge } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { contactOptions, filterCounts, threadDetail, threadList, type ThreadFilter } from "@/lib/queries/email";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "./_components/compose-dialog";
import { ThreadActions } from "./_components/thread-actions";
import { TriagePill } from "./_components/triage-pill";
import { StyleProfileCard } from "./_components/style-profile-card";

export const dynamic = "force-dynamic";

const FILTERS: { key: ThreadFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs review" },
  { key: "drafts_pending", label: "Drafts pending" },
  { key: "quote_request", label: "Quotes" },
  { key: "stock_check", label: "Stock checks" },
  { key: "po", label: "POs" },
  { key: "sample_request", label: "Samples" },
  { key: "submittal_request", label: "Submittals" },
  { key: "scheduling", label: "Scheduling" },
  { key: "general", label: "General" },
  { key: "archived", label: "Archived / noise" },
];

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; t?: string }>;
}) {
  const { f, t } = await searchParams;
  const filter = (FILTERS.some((x) => x.key === f) ? f : "all") as ThreadFilter;
  const [threads, counts, demoNow, contacts] = await Promise.all([
    threadList(filter),
    filterCounts(),
    getDemoNow(),
    contactOptions(),
  ]);
  const selectedId = t ?? threads[0]?.id;
  const detail = selectedId ? await threadDetail(selectedId) : null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Email</h1>
        <ComposeDialog contacts={contacts} />
      </div>

      <div className="flex h-[calc(100vh-9rem)] overflow-hidden rounded-lg border border-line bg-surface">
        {/* Pane 1: filters */}
        <nav className="hidden w-44 shrink-0 overflow-y-auto border-r border-line py-2 lg:block">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={`/email?f=${x.key}`}
              className={cn(
                "flex items-center justify-between px-3 py-1.5 text-[12px] transition-colors",
                filter === x.key ? "bg-surface2 text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {x.label}
              <span className="font-mono text-[10px] text-ink-faint">{counts[x.key] ?? 0}</span>
            </Link>
          ))}
          <div className="mt-3 border-t border-line px-3 pt-3">
            <StyleProfileCard />
          </div>
        </nav>

        {/* Pane 2: thread list */}
        <div className={cn("w-full shrink-0 overflow-y-auto border-r border-line sm:w-80", detail && "hidden sm:block")}>
          {threads.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Nothing here"
              copy="Threads matching this filter appear here. Triage runs metadata-first; noise is archived visibly."
            />
          ) : (
            threads.map((th) => (
              <Link
                key={th.id}
                href={`/email?f=${filter}&t=${th.id}`}
                className={cn(
                  "block border-b border-line px-3 py-2.5 transition-colors hover:bg-surface2/60",
                  th.id === selectedId && "bg-surface2",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-medium">{th.subject}</span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-faint">
                    {relativeAge(th.lastMessageAt, demoNow)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-ink-muted">{th.preview}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {th.triage ? <TriagePill category={th.triage} confidence={th.triageConfidence} /> : null}
                  {th.unprocessedCount > 0 ? <StatusPill tone="muted">unprocessed</StatusPill> : null}
                  {th.draftApprovalId ? (
                    <StatusPill tone="ok">draft ready</StatusPill>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pane 3: thread view */}
        <div className={cn("min-w-0 flex-1 overflow-y-auto", !detail && "hidden sm:block")}>
          {!detail ? (
            <EmptyState icon={Mail} title="Select a thread" copy="Messages render text-only — raw HTML never reaches the DOM." />
          ) : (
            <div className="p-4">
              <div className="mb-1 flex sm:hidden">
                <Link href={`/email?f=${filter}`} className="text-[12px] text-accent">
                  ← Back to list
                </Link>
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold">{detail.thread.subject}</h2>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                    {detail.thread.participants.join(" · ")}
                  </p>
                </div>
                {detail.thread.triage ? (
                  <TriagePill category={detail.thread.triage} confidence={detail.thread.triageConfidence ? Number(detail.thread.triageConfidence) : null} />
                ) : null}
              </div>

              <ThreadActions
                threadId={detail.thread.id}
                archived={detail.thread.status === "archived"}
                replyRoutingId={
                  detail.routings.find((r) => r.target === "reply" && r.status === "pending")?.id ?? null
                }
                quoteRoutingId={
                  detail.routings.find((r) => r.target === "quote" && r.status === "pending")?.id ?? null
                }
              />

              <div className="mt-4 space-y-3">
                {detail.messages.map((m) => (
                  <Card key={m.id} className={cn(m.direction === "outbound" && "border-accent/30")}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2">
                      <span className="font-mono text-[11px] text-ink-muted">
                        {m.direction === "outbound" ? "→ " : "← "}
                        {m.fromEmail}
                      </span>
                      <span className="font-mono text-[10px] text-ink-faint">{formatDateTime(m.receivedAt)}</span>
                    </div>
                    {/* text-only rendering — body_html is never passed to the DOM */}
                    <div className="whitespace-pre-wrap px-3.5 py-3 font-mono text-[12px] leading-relaxed">
                      {m.bodyText}
                    </div>
                    {m.attachments.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 border-t border-line px-3.5 py-2">
                        {m.attachments.map((a) => (
                          <a
                            key={a.blobKey}
                            href={`/api/blob/${a.blobKey}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-muted hover:border-accent"
                          >
                            <Paperclip className="h-3 w-3" />
                            {a.name} <Mono className="text-ink-faint">{Math.round(a.sizeBytes / 1024)}kb</Mono>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
