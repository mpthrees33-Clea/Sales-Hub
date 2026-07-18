/**
 * Approvals — the hero surface (WO-03). Server component: loads the pre-fetched
 * queue (sweeping expiries), then hands it to the keyboard-first client inbox.
 * `?id=` deep-links a specific approval (ticker/banner CTAs land here).
 */
import { loadQueue } from "@/lib/queries/approvals";
import { ApprovalsInbox } from "./_components/inbox";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const queue = await loadQueue();
  return <ApprovalsInbox demoNow={queue.demoNow} pending={queue.pending} initialId={id ?? null} />;
}
