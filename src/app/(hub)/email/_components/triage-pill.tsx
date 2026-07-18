import { StatusPill } from "@/components/ui";

const TONE: Record<string, "ok" | "warn" | "danger" | "accent" | "muted"> = {
  quote_request: "accent",
  stock_check: "accent",
  po: "ok",
  sample_request: "ok",
  submittal_request: "accent",
  scheduling: "muted",
  general: "muted",
  noise: "muted",
};

export function TriagePill({ category, confidence }: { category: string; confidence: number | null }) {
  return (
    <StatusPill tone={TONE[category] ?? "muted"}>
      {category.replace("_", " ")}
      {confidence != null ? ` ${Math.round(confidence * 100)}%` : ""}
    </StatusPill>
  );
}
