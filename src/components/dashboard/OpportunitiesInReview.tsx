import { Sparkles, Check, X, FolderPlus } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type {
  NewOpportunityCandidate, Project, ProjectExtensions,
} from '../../types';

// "Opportunities in Review" — pending candidate opportunities the rep
// created on the Samples page via the "+ Add to future opportunity" flow.
// Each candidate is a decision-point: promote into a real Project (CRM
// pickup) or discard. Linked sample orders are surfaced for context.

interface Props {
  onJumpToSamples?: (sampleOrderId: string) => void;
}

export default function OpportunitiesInReview({ onJumpToSamples }: Props) {
  const candidates = useAppStore((s) => s.opportunityCandidates);
  const customers = useAppStore((s) => s.customers);
  const currentRepId = useAppStore((s) => s.currentRepId);
  const reps = useAppStore((s) => s.reps);
  const sampleOrders = useAppStore((s) => s.sampleOrders);
  const addProject = useAppStore((s) => s.addProject);
  const updateSampleOrder = useAppStore((s) => s.updateSampleOrder);
  const updateOpportunityCandidate = useAppStore((s) => s.updateOpportunityCandidate);
  const discardOpportunityCandidate = useAppStore((s) => s.discardOpportunityCandidate);

  const pending = candidates.filter((c) => c.status === 'pending' && c.repId === currentRepId);

  function promote(c: NewOpportunityCandidate) {
    const rep = reps.find((r) => r.id === c.repId);
    const now = new Date();
    const projectId = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const project: Project & ProjectExtensions = {
      id: projectId,
      customerId: c.customerId,
      name: c.proposedName,
      description: c.notes ?? '',
      status: 'Lead',
      value: 0,
      productIds: [],
      sampleOrderIds: sampleOrders.filter((so) => so.candidateId === c.id).map((so) => so.id),
      notes: c.notes ? [{ id: `n-${Date.now()}`, date: now.toISOString().slice(0, 10), text: c.notes, author: rep?.name ?? 'You' }] : [],
      createdDate: now.toISOString().slice(0, 10),
      opportunityId: `OPP-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`,
      salesRepId: c.repId,
      salesLocationId: rep?.salesLocationId ?? '310',
      projectType: 'other',
      opportunityStatus: 'active',
      opportunityStage: 'lead_qualification',
      nextStep: 'Confirm spec and lock in the opportunity',
      updatedDate: now.toISOString(),
      bidders: [],
      lastTouchAt: now.toISOString(),
    };
    addProject(project);
    // Rewire every sample order that pointed at the candidate to point at
    // the real project. Keep candidateId for audit trail.
    for (const so of sampleOrders) {
      if (so.candidateId === c.id) {
        updateSampleOrder(so.id, { projectId });
      }
    }
    updateOpportunityCandidate(c.id, { status: 'promoted', promotedProjectId: projectId });
  }

  if (pending.length === 0) return null;

  return (
    <div className="bg-surface rounded-xl border border-accent/30 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-divider bg-accent/5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent-light" />
          <h2 className="text-sm font-semibold text-fg">Opportunities in Review</h2>
        </div>
        <p className="text-xs text-fg-muted">{pending.length} pending decision{pending.length === 1 ? '' : 's'}</p>
      </div>

      <ul className="divide-y divide-divider">
        {pending.map((c) => {
          const customer = customers.find((cu) => cu.id === c.customerId);
          const sourceSO = c.sourceSampleOrderId
            ? sampleOrders.find((so) => so.id === c.sourceSampleOrderId)
            : undefined;
          return (
            <li key={c.id} className="px-5 py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 text-accent-light flex items-center justify-center shrink-0">
                <FolderPlus size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg truncate">{c.proposedName}</p>
                <p className="text-xs text-fg-muted truncate">
                  {customer?.company ?? '—'} · created {c.createdDate}
                </p>
                {sourceSO && (
                  <button
                    onClick={() => onJumpToSamples?.(sourceSO.id)}
                    className="text-xs text-accent-light hover:text-accent mt-1"
                  >
                    From sample order {sourceSO.orderedDate} →
                  </button>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => promote(c)}
                  className={clsx(
                    'flex items-center gap-1 px-3 py-1.5 bg-success/10 text-success border border-success/30 rounded-lg',
                    'text-xs font-medium hover:bg-success/20 transition-colors',
                  )}
                  title="Promote to a real CRM project"
                >
                  <Check size={12} /> Promote
                </button>
                <button
                  onClick={() => discardOpportunityCandidate(c.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-bg text-fg-muted border border-divider rounded-lg text-xs hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors"
                  title="Discard — don't add to CRM"
                >
                  <X size={12} /> Discard
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
