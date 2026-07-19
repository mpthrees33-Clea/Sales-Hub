/**
 * Nightly fan-out dispatch registry (WO-08 task 1.3). Registry-based: each
 * routing target maps to a claim-based consumer loaded dynamically, so the
 * workflow runs green even when a specialist module isn't installed —
 * unmerged targets log a skipped step ({target, reason:
 * 'module_not_installed'}) instead of failing, and their routings stay
 * pending for when the module lands.
 *
 * Every consumer claims its routing atomically (claimRoutingById) and
 * completes/releases it itself — dispatch never double-claims.
 */
import { claimRoutingById, completeRouting, pendingRoutings, releaseRouting, type RoutingTarget } from "@/lib/routing";

export type DispatchOutcome =
  | { target: RoutingTarget; status: "consumed"; runId: string | null; detail?: Record<string, unknown> }
  | { target: RoutingTarget; status: "skipped"; reason: string }
  | { target: RoutingTarget; status: "empty" }
  | { target: RoutingTarget; status: "failed"; error: string };

type Consumer = (
  routingId: string,
  ctx: { workflowRunId: string },
) => Promise<{ runId: string | null; detail?: Record<string, unknown> } | null>;

async function resolveConsumer(target: RoutingTarget): Promise<Consumer | null> {
  try {
    switch (target) {
      case "quote": {
        const { runQuoteFromRouting } = await import("@/lib/quotes");
        return async (routingId, ctx) => {
          const res = await runQuoteFromRouting(routingId, { trigger: "nightly", workflowRunId: ctx.workflowRunId });
          return res ? { runId: res.runId, detail: { status: res.status } } : null;
        };
      }
      case "reply": {
        const { runReplyFromRouting } = await import("@/agents/email-reply");
        return async (routingId, ctx) => {
          const res = await runReplyFromRouting(routingId, { trigger: "nightly", workflowRunId: ctx.workflowRunId });
          return res ? { runId: res.runId, detail: { status: res.status } } : null;
        };
      }
      case "po_intake": {
        const { startPoIntake } = await import("@/app/api/workflows/po-intake/start");
        const { db } = await import("@/db/client");
        const { triageRoutings } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        return async (routingId, ctx) => {
          const claimed = await claimRoutingById(routingId, null);
          if (!claimed) return null; // already consumed — idempotent
          try {
            const routing = await db.query.triageRoutings.findFirst({ where: eq(triageRoutings.id, routingId) });
            const payload = routing?.payload as { attachmentBlobUrl?: string | null; emailId?: string } | null;
            if (!payload?.attachmentBlobUrl) throw new Error("po routing has no PDF attachment");
            const res = await startPoIntake({
              blobUrl: payload.attachmentBlobUrl,
              sourceEmailId: payload.emailId,
              trigger: "nightly",
              workflowRunId: ctx.workflowRunId,
            });
            await completeRouting(routingId, res.runId);
            return { runId: res.runId, detail: { status: res.status, poId: res.poId } };
          } catch (err) {
            await releaseRouting(routingId);
            throw err;
          }
        };
      }
      case "sample": {
        const mod = (await import("@/agents/" + "sample-order").catch(() => null)) as {
          runSampleFromRouting?: (
            id: string,
            opts: { trigger: "nightly"; workflowRunId?: string },
          ) => Promise<{ runId: string; status: string } | null>;
        } | null;
        if (!mod?.runSampleFromRouting) return null;
        return async (routingId, ctx) => {
          const res = await mod.runSampleFromRouting!(routingId, {
            trigger: "nightly",
            workflowRunId: ctx.workflowRunId,
          });
          return res ? { runId: res.runId, detail: { status: res.status } } : null;
        };
      }
      case "submittal": {
        const mod = (await import("@/lib/" + "submittals").catch(() => null)) as {
          runSubmittalFromRouting?: (
            id: string,
            opts: { trigger: "nightly"; workflowRunId?: string },
          ) => Promise<{ runId: string | null; status: string } | null>;
        } | null;
        if (!mod?.runSubmittalFromRouting) return null;
        return async (routingId, ctx) => {
          const res = await mod.runSubmittalFromRouting!(routingId, {
            trigger: "nightly",
            workflowRunId: ctx.workflowRunId,
          });
          return res ? { runId: res.runId, detail: { status: res.status } } : null;
        };
      }
      case "none":
        return null;
    }
  } catch {
    return null;
  }
}

/** Drain every pending routing for a target (consumers claim atomically). */
export async function dispatchTarget(
  target: Exclude<RoutingTarget, "none">,
  ctx: { workflowRunId: string },
): Promise<DispatchOutcome[]> {
  const consumer = await resolveConsumer(target);
  if (!consumer) {
    return [{ target, status: "skipped", reason: "module_not_installed" }];
  }
  const pending = await pendingRoutings(target);
  if (pending.length === 0) return [{ target, status: "empty" }];
  const outcomes: DispatchOutcome[] = [];
  for (const r of pending) {
    try {
      const res = await consumer(r.id, ctx);
      if (res) outcomes.push({ target, status: "consumed", runId: res.runId, detail: res.detail });
      // null ⇒ another claimant won — nothing to record
    } catch (err) {
      outcomes.push({ target, status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return outcomes.length ? outcomes : [{ target, status: "empty" }];
}
