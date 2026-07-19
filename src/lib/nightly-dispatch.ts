/**
 * Nightly fan-out dispatch (WO-08 task 3). Registry mapping a triage routing's
 * target to its specialist runner. Targets whose module isn't installed log a
 * skipped result instead of failing — the workflow runs green with only
 * WO-01/03/04 merged.
 */
import type { RoutingRow } from "@/lib/routing";

export type DispatchResult = { target: string; routingId: string; status: "ok" | "skipped" | "escalated" | "error"; detail?: string };

type Runner = (routingId: string) => Promise<{ status: string }>;

/** Lazily-loaded runners so an unmerged module never breaks import. */
const REGISTRY: Record<string, () => Promise<Runner | null>> = {
  quote: async () => {
    try {
      const { runQuoteFromRouting } = await import("@/lib/quotes");
      return (id) => runQuoteFromRouting(id, { trigger: "nightly" });
    } catch {
      return null;
    }
  },
  po_intake: async () => {
    try {
      const { startPoIntakeFromRouting } = await import("@/app/api/workflows/po-intake/start");
      return (id) => startPoIntakeFromRouting(id);
    } catch {
      return null;
    }
  },
  sample: async () => {
    try {
      const { runSampleFromRouting } = await import("@/lib/samples");
      return (id) => runSampleFromRouting(id);
    } catch {
      return null;
    }
  },
  reply: async () => {
    try {
      const { replyToRouting } = await import("@/agents/email-reply");
      return async (id) => {
        const r = await replyToRouting(id, { trigger: "nightly" });
        return { status: r.status };
      };
    } catch {
      return null;
    }
  },
  // WO-14 registers its runner here when merged; until then it degrades to a skip.
  submittal: async () => null,
};

export async function dispatchRouting(routing: RoutingRow): Promise<DispatchResult> {
  const target = routing.target;
  if (target === "none") return { target, routingId: routing.id, status: "skipped", detail: "noise" };
  const loader = REGISTRY[target];
  if (!loader) return { target, routingId: routing.id, status: "skipped", detail: "unknown_target" };
  const runner = await loader();
  if (!runner) return { target, routingId: routing.id, status: "skipped", detail: "module_not_installed" };
  try {
    const r = await runner(routing.id);
    return { target, routingId: routing.id, status: r.status === "escalated" ? "escalated" : r.status === "skipped" ? "skipped" : "ok", detail: r.status };
  } catch (err) {
    return { target, routingId: routing.id, status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}
