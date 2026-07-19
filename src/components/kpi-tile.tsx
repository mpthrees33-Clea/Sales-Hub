/**
 * <KpiTile /> — value, delta vs target, tiny sparkline; no chart-junk
 * (docs/03 §3). Contract {label, value, target, delta, spark} fixed in WO-01.
 */
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";

export function KpiTile({
  label,
  valueCents,
  targetCents,
  deltaPct,
  spark,
}: {
  label: string;
  valueCents: number;
  targetCents: number;
  deltaPct: number;
  spark: number[];
}) {
  const ahead = deltaPct >= 0;
  return (
    <div className="rounded-lg border border-line bg-surface p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] leading-tight text-ink-muted">{label}</span>
        <Sparkline points={spark} />
      </div>
      <div className="mt-2 font-mono text-xl tracking-tight">{formatCents(valueCents, { compact: true })}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("font-mono text-[11px]", ahead ? "text-ok" : "text-warn")}>
          {ahead ? "+" : ""}
          {deltaPct.toFixed(0)}%
        </span>
        <span className="text-[10px] text-ink-faint">vs {formatCents(targetCents, { compact: true })} target</span>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 64;
  const h = 20;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 text-ink-faint" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function KpiTileSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface p-3.5">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-3 h-6 w-20" />
      <div className="skeleton mt-2 h-3 w-28" />
    </div>
  );
}
