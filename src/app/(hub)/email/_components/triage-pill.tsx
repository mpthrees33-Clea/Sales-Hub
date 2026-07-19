/** Triage category pill with confidence (docs/03 §5, WO-04 task 8). */
import { StatusPill } from "@/components/ui";

const META: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "accent" | "muted" }> = {
  quote_request: { label: "quote", tone: "accent" },
  stock_check: { label: "stock", tone: "accent" },
  po: { label: "PO", tone: "warn" },
  sample_request: { label: "sample", tone: "ok" },
  submittal_request: { label: "submittal", tone: "accent" },
  scheduling: { label: "scheduling", tone: "ok" },
  general: { label: "general", tone: "muted" },
  noise: { label: "noise", tone: "muted" },
};

export function TriagePill({ category, confidence }: { category: string | null; confidence: number | null }) {
  if (!category) return <StatusPill tone="muted">untriaged</StatusPill>;
  const m = META[category] ?? { label: category, tone: "muted" as const };
  return (
    <StatusPill tone={m.tone}>
      {m.label}
      {confidence != null ? <span className="opacity-70">· {Math.round(confidence * 100)}%</span> : null}
    </StatusPill>
  );
}
