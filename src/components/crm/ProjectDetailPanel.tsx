import { useMemo, useState } from 'react';
import {
  X, MessageSquare, Briefcase, Building2, HardHat, Home,
  Calendar, MapPin, User as UserIcon, Receipt, Mail, TrendingUp, Clock,
  AlertCircle, ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type {
  Project, ProjectExtensions, ProjectStatus,
  OpportunityStatus, OpportunityStage, ProjectType, Activity,
} from '../../types';

type ExtendedProject = Project & ProjectExtensions;

interface Props { project: ExtendedProject; onClose: () => void; }

const STATUSES: ProjectStatus[] = ['Lead', 'Active', 'Bidding', 'Won', 'Lost'];

const STAGES: { key: OpportunityStage; label: string }[] = [
  { key: 'lead_qualification', label: 'Lead Qualification' },
  { key: 'design', label: 'Design' },
  { key: 'bidding', label: 'Bidding' },
  { key: 'awarded', label: 'Awarded' },
  { key: 'orders_pending', label: 'Orders Pending' },
  { key: 'orders_placed', label: 'Orders Placed' },
  { key: 'closed', label: 'Closed' },
];

const PROJECT_TYPES: { key: ProjectType; label: string }[] = [
  { key: 'multifamily', label: 'Multifamily' },
  { key: 'single_family', label: 'Single Family' },
  { key: 'corporate', label: 'Corporate / Office' },
  { key: 'government', label: 'Government' },
  { key: 'community', label: 'Community' },
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'hospitality', label: 'Hospitality' },
  { key: 'retail', label: 'Retail' },
  { key: 'mixed_use', label: 'Mixed Use' },
  { key: 'education', label: 'Education' },
  { key: 'industrial', label: 'Industrial' },
  { key: 'other', label: 'Other' },
];

const OPPORTUNITY_STATUSES: { key: OpportunityStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'not_pursued', label: 'Not Pursued' },
];

function daysAgo(iso: string | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
}

// 0–100 health score based on recency × stage progression × status.
// Higher = healthier opportunity worth attention.
function computeHealth(project: ExtendedProject): { score: number; color: string; label: string } {
  if (project.opportunityStatus === 'won') return { score: 100, color: 'bg-success/15 text-success border-success/30', label: 'Won' };
  if (project.opportunityStatus === 'lost' || project.opportunityStatus === 'not_pursued') {
    return { score: 0, color: 'bg-danger/15 text-danger border-danger/30', label: project.opportunityStatus === 'lost' ? 'Lost' : 'Not pursued' };
  }
  const days = daysAgo(project.lastTouchAt ?? project.updatedDate ?? project.createdDate);
  // Recency points: 100 if touched in last 7 days, scales down to 0 at 180 days
  const recencyScore = Math.max(0, Math.min(100, 100 - (days * 100) / 180));
  // Stage progression: further along = higher base
  const stageWeights: Record<OpportunityStage, number> = {
    lead_qualification: 30,
    design: 50,
    bidding: 65,
    awarded: 85,
    orders_pending: 90,
    orders_placed: 95,
    closed: 100,
  };
  const stageScore = stageWeights[project.opportunityStage ?? 'lead_qualification'];
  const score = Math.round(0.6 * recencyScore + 0.4 * stageScore);
  let color: string;
  let label: string;
  if (score >= 70) { color = 'bg-success/15 text-success border-success/30'; label = 'Healthy'; }
  else if (score >= 40) { color = 'bg-warning/15 text-warning border-warning/30'; label = 'Stalled'; }
  else { color = 'bg-danger/15 text-danger border-danger/30'; label = 'Cold'; }
  return { score, color, label };
}

export default function ProjectDetailPanel({ project, onClose }: Props) {
  const customers = useAppStore((s) => s.customers);
  const reps = useAppStore((s) => s.reps);
  const salesLocations = useAppStore((s) => s.salesLocations);
  const sampleOrders = useAppStore((s) => s.sampleOrders);
  const activities = useAppStore((s) => s.activities);
  const quotes = useAppStore((s) => s.quotes);
  const updateProject = useAppStore((s) => s.updateProject);

  const customer = customers.find((c) => c.id === project.customerId);
  const rep = reps.find((r) => r.id === project.salesRepId);
  const location = salesLocations.find((l) => l.id === project.salesLocationId);
  const architect = customers.find((c) => c.id === project.architecturalFirmId);
  const gc = customers.find((c) => c.id === project.gcCustomerId);
  const developer = customers.find((c) => c.id === project.developerCustomerId);
  const endUser = customers.find((c) => c.id === project.endUserCustomerId);

  const linkedOrders = sampleOrders.filter((o) => project.sampleOrderIds.includes(o.id));
  const projectActivities = activities.filter((a) => a.projectId === project.id);
  const projectQuotes = quotes.filter((q) => q.projectId === project.id);

  const health = useMemo(() => computeHealth(project), [project]);
  const stageDays = daysAgo(project.updatedDate ?? project.createdDate);
  const stageStalled = stageDays > 30 && project.opportunityStatus === 'active';

  const [noteText, setNoteText] = useState('');

  function set<K extends keyof (Project & ProjectExtensions)>(
    key: K,
    value: (Project & ProjectExtensions)[K],
  ) {
    updateProject(project.id, { [key]: value } as Partial<Project & ProjectExtensions>);
  }

  function addNote() {
    if (!noteText.trim()) return;
    const me = reps.find((r) => r.isCurrentUser);
    const note = {
      id: `n-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      text: noteText.trim(),
      author: me?.name ?? 'You',
    };
    updateProject(project.id, { notes: [...project.notes, note] });
    setNoteText('');
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full lg:w-[520px] bg-surface border-l border-divider shadow-xl flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-divider px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-fg-faint">
              <span className="font-mono">{project.opportunityId ?? `#${project.id}`}</span>
              {rep && <><span>·</span><span>{rep.initials}</span></>}
              {location && <><span>·</span><span>{location.id} {location.name}</span></>}
            </div>
            <h2 className="font-semibold text-fg truncate mt-0.5">{project.name}</h2>
            {customer && (
              <p className="text-xs text-fg-muted mt-0.5">{customer.company}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-1 shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Status + health row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium border', health.color)}>
            {health.label} · {health.score}
          </span>
          {stageStalled && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-warning/10 text-warning border-warning/30 flex items-center gap-1">
              <Clock size={11} /> {stageDays}d in {STAGES.find((s) => s.key === project.opportunityStage)?.label ?? 'stage'}
            </span>
          )}
          {project.opportunityStatus && (
            <span className="text-xs text-fg-muted">
              {OPPORTUNITY_STATUSES.find((s) => s.key === project.opportunityStatus)?.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* ── Stage selector ── */}
        <div>
          <Label icon={TrendingUp}>Stage</Label>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.key}
                onClick={() => set('opportunityStage', s.key)}
                className={clsx(
                  'text-xs px-2.5 py-1 rounded-md border transition-colors',
                  project.opportunityStage === s.key
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface-1 text-fg-muted border-divider hover:border-accent/40 hover:text-fg',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Core fields ── */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select
              value={project.opportunityStatus ?? 'active'}
              onChange={(v) => set('opportunityStatus', v as OpportunityStatus)}
              options={OPPORTUNITY_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
            />
          </Field>
          <Field label="Project Type">
            <Select
              value={project.projectType ?? 'other'}
              onChange={(v) => set('projectType', v as ProjectType)}
              options={PROJECT_TYPES.map((t) => ({ value: t.key, label: t.label }))}
            />
          </Field>
          <Field label="Project Value">
            <NumberInput
              prefix="$"
              value={project.value}
              onChange={(v) => set('value', v)}
            />
          </Field>
          <Field label="Anticipated Order">
            <DateInput
              value={project.anticipatedOrderDate ?? ''}
              onChange={(v) => set('anticipatedOrderDate', v)}
            />
          </Field>
        </div>

        {/* Next step — large free-form */}
        <Field label="Next Step">
          <textarea
            className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent resize-y"
            rows={2}
            value={project.nextStep ?? ''}
            onChange={(e) => set('nextStep', e.target.value)}
            placeholder="What's the very next action on this project?"
          />
        </Field>

        {/* Job location */}
        <Field label="Job Location" icon={MapPin}>
          <input
            className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            value={project.jobLocation ?? ''}
            onChange={(e) => set('jobLocation', e.target.value)}
            placeholder="City, state"
          />
        </Field>

        {/* ── Stakeholders ── */}
        <div>
          <Label icon={UserIcon}>Stakeholders</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <StakeholderRow
              roleLabel="Architect"
              icon={Briefcase}
              customer={architect}
              customers={customers}
              onChange={(id) => set('architecturalFirmId', id)}
            />
            <StakeholderRow
              roleLabel="GC"
              icon={HardHat}
              customer={gc}
              customers={customers}
              onChange={(id) => set('gcCustomerId', id)}
            />
            <StakeholderRow
              roleLabel="Developer"
              icon={Building2}
              customer={developer}
              customers={customers}
              onChange={(id) => set('developerCustomerId', id)}
            />
            <StakeholderRow
              roleLabel="End User"
              icon={Home}
              customer={endUser}
              customers={customers}
              onChange={(id) => set('endUserCustomerId', id)}
            />
          </div>
        </div>

        {/* ── Bidders ── */}
        {(project.bidders ?? []).length > 0 && (
          <div>
            <Label icon={Receipt}>Bidders ({project.bidders?.length})</Label>
            <div className="space-y-1.5">
              {project.bidders?.map((b) => {
                const c = customers.find((cu) => cu.id === b.customerId);
                return (
                  <div key={b.id} className="flex items-center justify-between bg-bg rounded px-3 py-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="text-fg font-medium truncate">{c?.company ?? 'Unknown'}</p>
                      <p className="text-fg-faint">Quoted {b.quotedDate.slice(0, 10)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {b.quotedAmount !== undefined && (
                        <p className="text-fg font-semibold">{fmt$(b.quotedAmount)}</p>
                      )}
                      {b.awarded && (
                        <p className="text-success text-xs font-medium">Awarded</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Activity timeline ── */}
        <div>
          <Label icon={Calendar}>Activity</Label>
          <ActivityTimeline
            project={project}
            activities={projectActivities}
            quoteCount={projectQuotes.length}
            sampleOrderCount={linkedOrders.length}
          />
        </div>

        {/* ── Notes ── */}
        <div>
          <Label icon={MessageSquare}>
            Notes ({project.notes.length})
          </Label>
          <div className="space-y-2 mb-2">
            {project.notes.length === 0 && (
              <p className="text-xs text-fg-faint italic">
                No notes yet. Email correspondence and in-person follow-ups go here.
              </p>
            )}
            {project.notes.map((n) => (
              <div key={n.id} className="text-xs bg-bg rounded px-3 py-2">
                <p className="text-fg whitespace-pre-wrap">{n.text}</p>
                <p className="text-fg-faint mt-1">{n.author} · {n.date}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm border border-divider rounded-lg px-3 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Add a note (email summary, call recap, site visit…)"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <button onClick={addNote} className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim">
              Add
            </button>
          </div>
        </div>

        {/* ── Footer metadata ── */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-divider text-xs text-fg-faint">
          <div><span className="text-fg-muted">Created</span> · {project.createdDate}</div>
          <div><span className="text-fg-muted">Updated</span> · {(project.updatedDate ?? project.createdDate).slice(0, 10)}</div>
          {project.cmdProjectId && (
            <div className="col-span-2"><span className="text-fg-muted">CMD</span> · {project.cmdProjectId}</div>
          )}
        </div>

        {/* Keep legacy ProjectStatus in sync with opportunity status — until
            slice 2 finishes the migration, both fields exist and Dashboard /
            Kanban still read .status. */}
        <ProjectStatusSync project={project} updateProject={updateProject} />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Label({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-fg-muted mb-2 flex items-center gap-1.5">
      {Icon && <Icon size={12} />}
      {children}
    </p>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-fg-muted mb-1 flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        className="w-full text-sm border border-divider rounded-lg px-3 py-2 pr-8 bg-surface focus:outline-none focus:ring-2 focus:ring-accent appearance-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" />
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-2 text-fg-faint text-sm">{prefix}</span>
      )}
      <input
        type="number"
        className={clsx(
          'w-full text-sm border border-divider rounded-lg py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent',
          prefix ? 'pl-7 pr-3' : 'px-3',
        )}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
      value={value.slice(0, 10)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function StakeholderRow({
  roleLabel,
  icon: Icon,
  customer,
  customers,
  onChange,
}: {
  roleLabel: string;
  icon: React.ElementType;
  customer: import('../../types').Customer | undefined;
  customers: import('../../types').Customer[];
  onChange: (id: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="bg-bg rounded-lg border border-divider">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Icon size={12} className="text-fg-faint" />
        <span className="text-xs text-fg-muted font-medium">{roleLabel}</span>
        <div className="flex-1" />
        {customer && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-fg-faint hover:text-accent-light"
          >
            change
          </button>
        )}
        {customer && !editing && (
          <button
            onClick={() => onChange(undefined)}
            className="text-xs text-fg-faint hover:text-danger"
          >
            clear
          </button>
        )}
      </div>
      {!customer || editing ? (
        <div className="px-2 pb-2">
          <select
            className="w-full text-xs border border-divider rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
            value={customer?.id ?? ''}
            onChange={(e) => {
              onChange(e.target.value || undefined);
              setEditing(false);
            }}
          >
            <option value="">— Not assigned —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.company} ({c.type})</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="px-2.5 pb-2">
          <p className="text-sm text-fg font-medium truncate">{customer.company}</p>
          <p className="text-xs text-fg-faint truncate">{customer.contacts[0]?.name ?? customer.name} · {customer.type}</p>
        </div>
      )}
    </div>
  );
}

function ActivityTimeline({
  project,
  activities,
  quoteCount,
  sampleOrderCount,
}: {
  project: ExtendedProject;
  activities: Activity[];
  quoteCount: number;
  sampleOrderCount: number;
}) {
  // Merge activities + notes into one chronologically-sorted feed.
  type FeedItem = {
    id: string;
    date: string;
    icon: React.ElementType;
    iconClass: string;
    text: string;
  };
  const feed: FeedItem[] = [];

  for (const a of activities) {
    feed.push({
      id: a.id,
      date: a.date,
      icon: activityIcon(a.type),
      iconClass: activityIconClass(a.type),
      text: a.summary,
    });
  }
  for (const n of project.notes) {
    feed.push({
      id: n.id,
      date: `${n.date}T12:00:00Z`,
      icon: MessageSquare,
      iconClass: 'text-fg-muted',
      text: `${n.text} (note · ${n.author})`,
    });
  }
  feed.sort((a, b) => b.date.localeCompare(a.date));

  // Always include the creation event as the anchor.
  if (!feed.length) {
    return (
      <p className="text-xs text-fg-faint italic">
        No activity logged yet. Emails, quotes, and notes will appear here as you work the project.
        {quoteCount > 0 && ` · ${quoteCount} quote(s) on file`}
        {sampleOrderCount > 0 && ` · ${sampleOrderCount} sample order(s)`}
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {feed.slice(0, 15).map((item) => (
        <div key={item.id} className="flex items-start gap-2 text-xs">
          <div className={clsx('w-6 h-6 rounded-full bg-surface-1 border border-divider flex items-center justify-center shrink-0', item.iconClass)}>
            <item.icon size={11} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-fg leading-tight">{item.text}</p>
            <p className="text-fg-faint mt-0.5">{relativeDate(item.date)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function activityIcon(type: Activity['type']): React.ElementType {
  switch (type) {
    case 'email_in':
    case 'email_out': return Mail;
    case 'quote_sent': return Receipt;
    case 'sample_sent': return Briefcase;
    case 'call':
    case 'meeting': return UserIcon;
    case 'site_visit': return MapPin;
    case 'stage_change':
    case 'status_change': return TrendingUp;
    case 'note':
    default: return MessageSquare;
  }
}

function activityIconClass(type: Activity['type']): string {
  switch (type) {
    case 'email_in':
    case 'email_out': return 'text-accent-light';
    case 'quote_sent': return 'text-warning';
    case 'sample_sent': return 'text-accent-light';
    case 'stage_change':
    case 'status_change': return 'text-success';
    default: return 'text-fg-muted';
  }
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Keep legacy ProjectStatus in sync with OpportunityStatus so the existing
// Kanban / Dashboard / pipeline calculations don't go stale until the
// migration to opportunityStatus is complete in part B.
function ProjectStatusSync({
  project,
  updateProject,
}: {
  project: ExtendedProject;
  updateProject: (id: string, patch: Partial<ExtendedProject>) => void;
}) {
  const derivedStatus: ProjectStatus = (() => {
    if (project.opportunityStatus === 'won') return 'Won';
    if (project.opportunityStatus === 'lost') return 'Lost';
    if (project.opportunityStage === 'bidding') return 'Bidding';
    if (project.opportunityStage === 'lead_qualification') return 'Lead';
    return 'Active';
  })();

  if (project.status !== derivedStatus && STATUSES.includes(derivedStatus)) {
    // Defer to next tick to avoid render loops.
    queueMicrotask(() => updateProject(project.id, { status: derivedStatus }));
  }
  return null;
}
