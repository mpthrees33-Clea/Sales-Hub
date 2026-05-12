import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Plus, List, LayoutGrid, Search } from 'lucide-react';
import clsx from 'clsx';
import type {
  Project, ProjectExtensions, OpportunityStage, OpportunityStatus, ProjectType,
} from '../types';
import NewProjectModal from '../components/crm/NewProjectModal';
import ProjectDetailPanel from '../components/crm/ProjectDetailPanel';

type ExtendedProject = Project & ProjectExtensions;

// Stages to render as Kanban columns. We drop 'closed' from the board view —
// terminal projects stay accessible via the list view + filters.
const KANBAN_STAGES: { key: OpportunityStage; label: string }[] = [
  { key: 'lead_qualification', label: 'Lead Qualification' },
  { key: 'design',              label: 'Design' },
  { key: 'bidding',             label: 'Bidding' },
  { key: 'awarded',             label: 'Awarded' },
  { key: 'orders_pending',      label: 'Orders Pending' },
  { key: 'orders_placed',       label: 'Orders Placed' },
];

const STAGE_HEADER_COLORS: Record<OpportunityStage, string> = {
  lead_qualification: 'bg-surface-1 text-fg',
  design:             'bg-accent/15 text-accent-light',
  bidding:            'bg-warning/15 text-warning',
  awarded:            'bg-success/15 text-success',
  orders_pending:     'bg-success/15 text-success',
  orders_placed:      'bg-success/15 text-success',
  closed:             'bg-surface-1 text-fg-muted',
};

const PROJECT_TYPES: { key: ProjectType; label: string }[] = [
  { key: 'multifamily', label: 'Multifamily' },
  { key: 'corporate', label: 'Corporate' },
  { key: 'government', label: 'Government' },
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'hospitality', label: 'Hospitality' },
  { key: 'retail', label: 'Retail' },
  { key: 'mixed_use', label: 'Mixed Use' },
  { key: 'education', label: 'Education' },
  { key: 'industrial', label: 'Industrial' },
  { key: 'single_family', label: 'Single Family' },
  { key: 'community', label: 'Community' },
  { key: 'other', label: 'Other' },
];

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
}
function daysAgo(iso: string | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── Card (Kanban) ──────────────────────────────────────────────
function KanbanCard({ project, onClick }: { project: ExtendedProject; onClick: () => void }) {
  const customers = useAppStore((s) => s.customers);
  const customer = customers.find((c) => c.id === project.customerId);
  const dormant = daysAgo(project.lastTouchAt) >= 90;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left bg-surface rounded-lg border p-3 hover:shadow-md hover:border-accent/40 transition-all',
        dormant ? 'border-warning/30' : 'border-divider',
      )}
    >
      <p className="font-medium text-fg text-sm leading-tight truncate">{project.name}</p>
      <p className="text-xs text-fg-muted truncate mt-0.5">{customer?.company ?? '—'}</p>
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs font-semibold text-fg">{fmt$(project.value)}</span>
        <span className={clsx('text-xs', dormant ? 'text-warning' : 'text-fg-faint')}>
          {dormant ? `dormant ${daysAgo(project.lastTouchAt)}d` : `${daysAgo(project.lastTouchAt)}d`}
        </span>
      </div>
      {project.nextStep && (
        <p className="text-xs text-fg-faint mt-1.5 line-clamp-2 italic">→ {project.nextStep}</p>
      )}
    </button>
  );
}

// ── Kanban board ───────────────────────────────────────────────
function KanbanBoard({
  projects,
  onSelect,
}: {
  projects: ExtendedProject[];
  onSelect: (p: ExtendedProject) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {KANBAN_STAGES.map((stage) => {
        const cols = projects.filter((p) => (p.opportunityStage ?? 'lead_qualification') === stage.key);
        const total = cols.reduce((s, p) => s + p.value, 0);
        return (
          <div key={stage.key} className="flex-shrink-0 w-60">
            <div className={clsx(
              'flex items-center justify-between px-3 py-2 rounded-t-lg font-semibold text-xs',
              STAGE_HEADER_COLORS[stage.key],
            )}>
              <span>{stage.label}</span>
              <span>{cols.length} · {fmt$(total)}</span>
            </div>
            <div className="space-y-2 p-2 bg-surface-1 rounded-b-lg min-h-[120px]">
              {cols.length === 0 ? (
                <p className="text-xs text-fg-faint text-center py-4">—</p>
              ) : (
                cols.map((p) => <KanbanCard key={p.id} project={p} onClick={() => onSelect(p)} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List view ──────────────────────────────────────────────────
type SortKey = 'updatedDate' | 'value' | 'anticipatedOrderDate' | 'lastTouchAt' | 'name';

function ListView({
  projects,
  onSelect,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
}: {
  projects: ExtendedProject[];
  onSelect: (p: ExtendedProject) => void;
  sortBy: SortKey;
  setSortBy: (k: SortKey) => void;
  sortDir: 'asc' | 'desc';
  setSortDir: (d: 'asc' | 'desc') => void;
}) {
  const customers = useAppStore((s) => s.customers);
  const reps = useAppStore((s) => s.reps);

  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => {
      const av = a[sortBy] ?? '';
      const bv = b[sortBy] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [projects, sortBy, sortDir]);

  function header(label: string, key: SortKey, align: 'left' | 'right' = 'left') {
    const active = sortBy === key;
    return (
      <th
        className={clsx(
          'px-3 py-2 cursor-pointer select-none',
          align === 'right' ? 'text-right' : 'text-left',
          active && 'text-accent-light',
        )}
        onClick={() => {
          if (active) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
          else { setSortBy(key); setSortDir('desc'); }
        }}
      >
        {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-divider bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-bg text-xs text-fg-muted uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left font-mono">Opp ID</th>
            {header('Project', 'name')}
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Stage</th>
            {header('Value', 'value', 'right')}
            <th className="px-3 py-2 text-left">Rep</th>
            <th className="px-3 py-2 text-left">Next Step</th>
            {header('Last Touch', 'lastTouchAt')}
            {header('Order By', 'anticipatedOrderDate')}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {sorted.length === 0 ? (
            <tr><td colSpan={10} className="px-3 py-8 text-fg-faint text-center">No projects match the current filters.</td></tr>
          ) : sorted.map((p) => {
            const cust = customers.find((c) => c.id === p.customerId);
            const rep = reps.find((r) => r.id === p.salesRepId);
            const dormant = daysAgo(p.lastTouchAt) >= 90;
            return (
              <tr key={p.id} className="hover:bg-bg cursor-pointer" onClick={() => onSelect(p)}>
                <td className="px-3 py-2 text-fg-faint text-xs font-mono">{p.opportunityId ?? p.id}</td>
                <td className="px-3 py-2 font-medium text-fg">{p.name}</td>
                <td className="px-3 py-2 text-fg-muted">{cust?.company ?? '—'}</td>
                <td className="px-3 py-2 text-fg-muted text-xs">{PROJECT_TYPES.find((t) => t.key === p.projectType)?.label ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium border',
                    STAGE_HEADER_COLORS[p.opportunityStage ?? 'lead_qualification'],
                  )}>
                    {KANBAN_STAGES.find((s) => s.key === p.opportunityStage)?.label ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium text-fg">{fmt$(p.value)}</td>
                <td className="px-3 py-2 text-fg-muted text-xs">{rep?.initials ?? '—'}</td>
                <td className="px-3 py-2 text-fg-muted text-xs italic truncate max-w-[220px]">{p.nextStep ?? '—'}</td>
                <td className={clsx('px-3 py-2 text-xs', dormant ? 'text-warning' : 'text-fg-muted')}>
                  {daysAgo(p.lastTouchAt)}d ago
                </td>
                <td className="px-3 py-2 text-fg-muted text-xs">{p.anticipatedOrderDate ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function CRMPage() {
  const projects = useAppStore((s) => s.projects);
  const reps = useAppStore((s) => s.reps);
  const currentRepId = useAppStore((s) => s.currentRepId);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selected, setSelected] = useState<ExtendedProject | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [repFilter, setRepFilter] = useState<'mine' | 'all'>('mine');
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('active');
  const [dormantOnly, setDormantOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState<SortKey>('lastTouchAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Honor cross-page nav (Dashboard sets selectedProjectId, we open the panel)
  useEffect(() => {
    if (!selectedProjectId) return;
    const p = projects.find((x) => x.id === selectedProjectId);
    if (p) setSelected(p);
    setSelectedProjectId(null);
  }, [selectedProjectId, projects, setSelectedProjectId]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (repFilter === 'mine' && p.salesRepId !== currentRepId) return false;
      if (typeFilter !== 'all' && p.projectType !== typeFilter) return false;
      if (statusFilter !== 'all' && p.opportunityStatus !== statusFilter) return false;
      if (dormantOnly && daysAgo(p.lastTouchAt) < 90) return false;
      if (q) {
        const hay = `${p.name} ${p.opportunityId ?? ''} ${p.jobLocation ?? ''} ${p.nextStep ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projects, repFilter, currentRepId, typeFilter, statusFilter, dormantOnly, search]);

  const pipelineValue = filtered
    .filter((p) => p.opportunityStatus !== 'lost' && p.opportunityStatus !== 'not_pursued')
    .reduce((s, p) => s + p.value, 0);
  const dormantCount = filtered.filter((p) => daysAgo(p.lastTouchAt) >= 90).length;

  return (
    <div className="space-y-4">
      {/* ── Top control bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-divider overflow-hidden shrink-0">
          <button onClick={() => setView('kanban')}
            className={clsx('px-3 py-1.5 text-sm flex items-center gap-1.5', view === 'kanban' ? 'bg-accent text-white' : 'bg-surface text-fg-muted hover:bg-bg')}>
            <LayoutGrid size={14} /> Kanban
          </button>
          <button onClick={() => setView('list')}
            className={clsx('px-3 py-1.5 text-sm flex items-center gap-1.5', view === 'list' ? 'bg-accent text-white' : 'bg-surface text-fg-muted hover:bg-bg')}>
            <List size={14} /> List
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-divider rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Search name, location, opp ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1" />
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim shrink-0">
          <Plus size={14} /> New Opportunity
        </button>
      </div>

      {/* ── Filter chip row ── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FilterGroup label="Rep" value={repFilter} onChange={(v) => setRepFilter(v as 'mine' | 'all')}
          options={[
            { value: 'mine', label: `Mine (${reps.find((r) => r.id === currentRepId)?.initials ?? 'me'})` },
            { value: 'all', label: 'All reps' },
          ]} />
        <FilterGroup label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as OpportunityStatus | 'all')}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'on_hold', label: 'On hold' },
            { value: 'won', label: 'Won' },
            { value: 'lost', label: 'Lost' },
          ]} />
        <FilterGroup label="Type" value={typeFilter} onChange={(v) => setTypeFilter(v as ProjectType | 'all')}
          options={[
            { value: 'all', label: 'All types' },
            ...PROJECT_TYPES.map((t) => ({ value: t.key, label: t.label })),
          ]} />
        <button
          onClick={() => setDormantOnly((v) => !v)}
          className={clsx(
            'px-2.5 py-1 rounded-md border transition-colors',
            dormantOnly
              ? 'bg-warning/15 text-warning border-warning/40'
              : 'bg-surface text-fg-muted border-divider hover:border-accent/40',
          )}
        >
          {dormantOnly ? '✓ ' : ''}Dormant only (90+ days)
        </button>

        <div className="flex-1" />
        <div className="text-fg-muted">
          {filtered.length} projects · pipeline {fmt$(pipelineValue)}
          {dormantCount > 0 && <span className="text-warning ml-2">· {dormantCount} dormant</span>}
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanBoard projects={filtered} onSelect={setSelected} />
      ) : (
        <ListView
          projects={filtered}
          onSelect={setSelected}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortDir={sortDir}
          setSortDir={setSortDir}
        />
      )}

      {selected && (
        <ProjectDetailPanel project={selected} onClose={() => setSelected(null)} />
      )}

      {showModal && (
        <NewProjectModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-divider">
      <span className="text-fg-faint">{label}:</span>
      <select
        className="bg-transparent text-fg-muted focus:outline-none text-xs cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-fg">{o.label}</option>
        ))}
      </select>
    </div>
  );
}
