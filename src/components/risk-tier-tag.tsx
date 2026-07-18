import { StatusPill } from "@/components/ui";

/** Risk tier with semantic color (docs/03 §3). Contract fixed in WO-01. */
export function RiskTierTag({ tier }: { tier: "low" | "standard" | "high" }) {
  const tone = tier === "high" ? "danger" : tier === "standard" ? "accent" : "ok";
  return <StatusPill tone={tone}>{tier.toUpperCase()}</StatusPill>;
}
