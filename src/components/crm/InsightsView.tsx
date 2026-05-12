import { useMemo, useState } from 'react';
import { Trophy, HardHat, TrendingUp, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type { GcSubEdge, Customer, Project, ProjectExtensions } from '../../types';

type ExtendedProject = Project & ProjectExtensions;

// GC↔sub learning view. Aggregates GcSubEdges (and live bidders from current
// projects) to surface which subs are winning flooring work with which GCs
// — the user's "I want to learn what sub contractors are winning projects
// with specific GCs" requirement.
//
// Two views:
//   1. GC leaderboard — every GC we've seen, sorted by total awarded value,
//      with the top winning subs underneath.
//   2. GC detail — click a row to drill into project-level history.

interface GcRow {
  gcId: string;
  gc: Customer;
  totalValue: number;
  awardCount: number;
  subBreakdown: { sub: Customer; awards: number; totalValue: number }[];
  recentEdges: GcSubEdge[];
}

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
}

export default function InsightsView() {
  const customers = useAppStore((s) => s.customers);
  const gcSubEdges = useAppStore((s) => s.gcSubEdges);
  const projects = useAppStore((s) => s.projects);
  const [expandedGcId, setExpandedGcId] = useState<string | null>(null);

  const rows = useMemo<GcRow[]>(() => {
    // Also pull live "awarded" bidders off current projects — anything with
    // gcCustomerId set and a bidder marked awarded counts as an edge.
    const liveEdges: GcSubEdge[] = [];
    for (const p of projects) {
      if (!p.gcCustomerId) continue;
      for (const b of p.bidders ?? []) {
        if (b.awarded) {
          liveEdges.push({
            id: `live-${b.id}`,
            gcCustomerId: p.gcCustomerId,
            subCustomerId: b.customerId,
            projectId: p.id,
            wonDate: b.quotedDate,
            projectValue: b.quotedAmount,
          });
        }
      }
    }
    const allEdges = [...gcSubEdges, ...liveEdges];

    const byGc = new Map<string, GcRow>();
    for (const edge of allEdges) {
      const gc = customers.find((c) => c.id === edge.gcCustomerId);
      const sub = customers.find((c) => c.id === edge.subCustomerId);
      if (!gc || !sub) continue;

      let row = byGc.get(gc.id);
      if (!row) {
        row = {
          gcId: gc.id,
          gc,
          totalValue: 0,
          awardCount: 0,
          subBreakdown: [],
          recentEdges: [],
        };
        byGc.set(gc.id, row);
      }
      row.totalValue += edge.projectValue ?? 0;
      row.awardCount += 1;
      row.recentEdges.push(edge);

      let sb = row.subBreakdown.find((s) => s.sub.id === sub.id);
      if (!sb) {
        sb = { sub, awards: 0, totalValue: 0 };
        row.subBreakdown.push(sb);
      }
      sb.awards += 1;
      sb.totalValue += edge.projectValue ?? 0;
    }

    // Sort each row's sub breakdown desc by total value
    for (const row of byGc.values()) {
      row.subBreakdown.sort((a, b) => b.totalValue - a.totalValue);
      row.recentEdges.sort((a, b) => b.wonDate.localeCompare(a.wonDate));
    }

    return [...byGc.values()].sort((a, b) => b.totalValue - a.totalValue);
  }, [gcSubEdges, customers, projects]);

  // Aggregate totals across the whole leaderboard
  const totalEdges = rows.reduce((s, r) => s + r.awardCount, 0);
  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
  const distinctSubs = new Set(rows.flatMap((r) => r.subBreakdown.map((s) => s.sub.id))).size;

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <SummaryStat label="GCs tracked" value={rows.length.toString()} icon={HardHat} />
        <SummaryStat label="Total awards" value={totalEdges.toString()} icon={Trophy} />
        <SummaryStat label="Subs in pool" value={distinctSubs.toString()} icon={TrendingUp} />
        <SummaryStat label="Total $ awarded" value={fmt$(totalValue)} icon={Trophy} />
      </div>

      <div className="rounded-lg border border-divider bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg">GC ↔ Sub relationships</h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Who's winning flooring work with each GC. Learn which sub relationships matter for the next bid.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-fg-faint italic">
            No GC↔sub history yet. Awards accumulate here as quotes ship and bidders are marked awarded.
          </p>
        ) : (
          <ul className="divide-y divide-divider">
            {rows.map((row) => (
              <li key={row.gcId}>
                <button
                  onClick={() => setExpandedGcId(expandedGcId === row.gcId ? null : row.gcId)}
                  className="w-full text-left px-4 py-3 hover:bg-bg flex items-center gap-3 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 text-accent-light flex items-center justify-center shrink-0">
                    <HardHat size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-medium text-fg">{row.gc.company}</p>
                      <span className="text-xs text-fg-faint">{row.gc.billingCity}, {row.gc.billingState}</span>
                    </div>
                    <p className="text-xs text-fg-muted mt-0.5">
                      {row.awardCount} award{row.awardCount === 1 ? '' : 's'} ·{' '}
                      {row.subBreakdown.length} sub{row.subBreakdown.length === 1 ? '' : 's'} in the mix ·{' '}
                      Top: <span className="text-accent-light font-medium">{row.subBreakdown[0]?.sub.company}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-fg">{fmt$(row.totalValue)}</p>
                    <p className="text-xs text-fg-faint">total awarded</p>
                  </div>
                  <ChevronRight
                    size={14}
                    className={clsx('text-fg-faint shrink-0 transition-transform', expandedGcId === row.gcId && 'rotate-90')}
                  />
                </button>

                {expandedGcId === row.gcId && (
                  <div className="bg-bg/50 border-t border-divider px-4 py-4 space-y-3">
                    {/* Sub leaderboard */}
                    <div>
                      <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">
                        Sub leaderboard — who wins flooring with {row.gc.company}
                      </p>
                      <ul className="space-y-1.5">
                        {row.subBreakdown.map((sb, i) => {
                          const sharePct = Math.round((sb.totalValue / row.totalValue) * 100);
                          return (
                            <li key={sb.sub.id} className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-fg-faint w-6 shrink-0">#{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm text-fg truncate">{sb.sub.company}</span>
                                  <span className="text-xs text-fg-faint">({sb.sub.type})</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-1">
                                  <div
                                    className={clsx(
                                      'h-full rounded-full',
                                      i === 0 ? 'bg-accent' : i === 1 ? 'bg-accent-light' : 'bg-accent-dim',
                                    )}
                                    style={{ width: `${sharePct}%` }}
                                  />
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold text-fg">{fmt$(sb.totalValue)}</p>
                                <p className="text-xs text-fg-faint">{sb.awards}× · {sharePct}%</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Recent awards detail */}
                    <div>
                      <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">
                        Recent awards
                      </p>
                      <ul className="space-y-1 text-xs text-fg-muted">
                        {row.recentEdges.slice(0, 5).map((edge) => {
                          const sub = customers.find((c) => c.id === edge.subCustomerId);
                          return (
                            <li key={edge.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">
                                {edge.wonDate.slice(0, 10)} · <span className="text-fg">{sub?.company ?? '—'}</span>
                              </span>
                              <span className="text-fg-faint shrink-0">
                                {edge.projectValue ? fmt$(edge.projectValue) : '—'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <p className="text-xs text-fg-faint italic">
                      Use these patterns when targeting new bids — pitch through the sub most likely to win.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-surface rounded-xl border border-divider p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-light">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-fg-muted uppercase tracking-wide">{label}</p>
        <p className="text-xl font-semibold text-fg tabular-nums">{value}</p>
      </div>
    </div>
  );
}
