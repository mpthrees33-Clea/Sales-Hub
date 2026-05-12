import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Plus, List, LayoutGrid, Search, Flame, AlarmClock, Snowflake, CalendarClock, BarChart3,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  Project, ProjectExtensions, OpportunityStage, OpportunityStatus, ProjectType,
} from '../types';
import NewProjectModal from '../components/crm/NewProjectModal';
import ProjectDetailPanel from '../components/crm/ProjectDetailPanel';
import InsightsView from '../components/crm/InsightsView';

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

// ── Smart-filter presets ──────────────────────────────────────
// One-tap views the rep can act on. Each preset applies additional
// constraints on top of the regular chip filters. Designed to match the
// daily workflow: "what's hot, what's stalled, what's quiet, what's closing".
type PresetKey = 'hot' | 'needs_followup' | 'stalled_bidding' | 'closing_soon';

const PRESETS: {
  key: PresetKey;
  label: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}[] = [
  {
    key: 'hot',
    label: 'Hot this week',
    description: 'Touched in the last 7 days, value > $50k',
    icon: Flame,
    iconClass: 'text-warning',
  },
  {
    key: 'needs_followup',
    label: 'Needs follow-up',
    description: 'Active opportunities quiet 14–90 days',
    icon: AlarmClock,
    iconClass: 'text-accent-light',
  },
  {
    key: 'stalled_bidding',
    label: 'Stalled bidding',
    description: 'Bidding stage with no movement in 30+ days',
    icon: Snowflake,
    iconClass: 'text-warning',
  },
  {
    key: 'closing_soon',
    label: 'Closing soon',
    description: 'Anticipated order date within the next 30 days',
    icon: CalendarClock,
    iconClass: 'text-success',
  },
];

function matchesPreset(p: ExtendedProject, preset: PresetKey): boolean {
  const touch = daysAgo(p.lastTouchAt);
  const orderDays = p.anticipatedOrderDate
    ? Math.floor((new Date(p.anticipatedOrderDate).getTime() - Date.now()) / 86400000)
    : Infinity;
  switch (preset) {
    case 'hot':
      return touch < 7 && p.value > 50000;
    case 'needs_followup':
      return p.opportunityStatus === 'active' && touch >= 14 && touch < 90;
    case 'stalled_bidding':
      return p.opportunityStage === 'bidding' && touch >= 30;
    case 'closing_soon':
      return orderDays >= 0 && orderDays <= 30 && p.opportunityStatus !== 'lost' && p.opportunityStatus !== 'not_pursued';
  }
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
type SortKey =
  | 'opportunityId'
  | 'name'
  | 'customer'
  | 'projectType'
  | 'opportunityStage'
  | 'value'
  | 'salesRep'
  | 'nextStep'
  | 'lastTouchAt'
  | 'anticipatedOrderDate'
  | 'updatedDate';

// Pre-defined stage ordering — sorting by stage should reflect the pipeline
// flow (lead qualification → orders placed), not alphabetical.
const STAGE_SORT_ORDER: Record<OpportunityStage, number> = {
  lead_qualification: 1,
  design: 2,
  bidding: 3,
  awarded: 4,
  orders_pending: 5,
  orders_placed: 6,
  closed: 7,
};

function sortValue(
  p: ExtendedProject,
  key: SortKey,
  customers: ReturnType<typeof useAppStore.getState>['customers'],
  reps: ReturnType<typeof useAppStore.getState>['reps'],
): string | number {
  switch (key) {
    case 'opportunityId':       return p.opportunityId ?? p.id;
    case 'name':                return p.name.toLowerCase();
    case 'customer':            return (customers.find((c) => c.id === p.customerId)?.company ?? '').toLowerCase();
    case 'projectType':         return (p.projectType ?? '').toLowerCase();
    case 'opportunityStage':    return STAGE_SORT_ORDER[p.opportunityStage ?? 'lead_qualification'];
    case 'value':               return p.value;
    case 'salesRep':            return (reps.find((r) => r.id === p.salesRepId)?.initials ?? '').toLowerCase();
    case 'nextStep':            return (p.nextStep ?? '').toLowerCase();
    case 'lastTouchAt':         return p.lastTouchAt ?? '';
    case 'anticipatedOrderDate': return p.anticipatedOrderDate ?? '';
    case 'updatedDate':         return p.updatedDate ?? '';
  }
}

// Threshold past which we virtualize. Below this, the regular table renders
// — table semantics + sticky-thead is the better UX. Above this, we switch
// to a grid-of-rows view that only renders the visible window.
const VIRTUALIZE_THRESHOLD = 200;
const VIRTUAL_ROW_HEIGHT = 44;
const VIRTUAL_CONTAINER_HEIGHT = 600;
const VIRTUAL_BUFFER = 5;

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
  // Sort uses a value extractor (sortValue) so columns like customer, stage,
  // and rep — which require a lookup or a predefined order — sort correctly.
  const customers = useAppStore((s) => s.customers);
  const reps = useAppStore((s) => s.reps);
  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => {
      const av = sortValue(a, sortBy, customers, reps);
      const bv = sortValue(b, sortBy, customers, reps);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [projects, sortBy, sortDir, customers, reps]);

  // Architecture note: above the threshold we virtualize the row render to
  // keep the DOM small (the system needs to handle 10–15K projects per the
  // user spec). Until 200 rows the regular table is faster + keyboard-
  // friendlier; past 200 we switch to a windowed grid renderer.
  if (sorted.length > VIRTUALIZE_THRESHOLD) {
    return (
      <VirtualizedListView
        projects={sorted}
        onSelect={onSelect}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDir={sortDir}
        setSortDir={setSortDir}
      />
    );
  }

  return (
    <TableListView
      projects={sorted}
      onSelect={onSelect}
      sortBy={sortBy}
      setSortBy={setSortBy}
      sortDir={sortDir}
      setSortDir={setSortDir}
    />
  );
}

interface ListViewProps {
  projects: ExtendedProject[];
  onSelect: (p: ExtendedProject) => void;
  sortBy: SortKey;
  setSortBy: (k: SortKey) => void;
  sortDir: 'asc' | 'desc';
  setSortDir: (d: 'asc' | 'desc') => void;
}

function TableListView({ projects, onSelect, sortBy, setSortBy, sortDir, setSortDir }: ListViewProps) {
  const customers = useAppStore((s) => s.customers);
  const reps = useAppStore((s) => s.reps);

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
            {header('Opp ID', 'opportunityId')}
            {header('Project', 'name')}
            {header('Customer', 'customer')}
            {header('Type', 'projectType')}
            {header('Stage', 'opportunityStage')}
            {header('Value', 'value', 'right')}
            {header('Rep', 'salesRep')}
            {header('Next Step', 'nextStep')}
            {header('Last Touch', 'lastTouchAt')}
            {header('Order By', 'anticipatedOrderDate')}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {projects.length === 0 ? (
            <tr><td colSpan={10} className="px-3 py-8 text-fg-faint text-center">No projects match the current filters.</td></tr>
          ) : projects.map((p) => {
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

// Virtualized renderer for 200+ projects. Renders rows as absolute-positioned
// grid items inside a tall scroll container; only the visible window + a
// small buffer mounts at any time. DOM stays small regardless of total
// project count.
function VirtualizedListView({ projects, onSelect, sortBy, setSortBy, sortDir, setSortDir }: ListViewProps) {
  const customers = useAppStore((s) => s.customers);
  const reps = useAppStore((s) => s.reps);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_BUFFER);
  const endIndex = Math.min(
    projects.length,
    Math.ceil((scrollTop + VIRTUAL_CONTAINER_HEIGHT) / VIRTUAL_ROW_HEIGHT) + VIRTUAL_BUFFER,
  );
  const visible = projects.slice(startIndex, endIndex);

  const gridCols = 'minmax(110px,auto) minmax(180px,1.4fr) minmax(140px,1fr) 110px 150px 90px 50px minmax(160px,1.4fr) 90px 100px';

  function HeaderCell({ label, sortKey, align }: { label: string; sortKey?: SortKey; align?: 'right' }) {
    const active = sortKey && sortBy === sortKey;
    return (
      <button
        type="button"
        onClick={() => {
          if (!sortKey) return;
          if (active) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
          else { setSortBy(sortKey); setSortDir('desc'); }
        }}
        disabled={!sortKey}
        className={clsx(
          'px-3 py-2 text-xs uppercase tracking-wide',
          align === 'right' ? 'text-right' : 'text-left',
          active ? 'text-accent-light' : 'text-fg-muted',
          sortKey ? 'cursor-pointer hover:text-fg' : 'cursor-default',
        )}
      >
        {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-divider bg-surface overflow-hidden">
      {/* Header row */}
      <div className="grid bg-bg border-b border-divider" style={{ gridTemplateColumns: gridCols }}>
        <HeaderCell label="Opp ID" sortKey="opportunityId" />
        <HeaderCell label="Project" sortKey="name" />
        <HeaderCell label="Customer" sortKey="customer" />
        <HeaderCell label="Type" sortKey="projectType" />
        <HeaderCell label="Stage" sortKey="opportunityStage" />
        <HeaderCell label="Value" sortKey="value" align="right" />
        <HeaderCell label="Rep" sortKey="salesRep" />
        <HeaderCell label="Next Step" sortKey="nextStep" />
        <HeaderCell label="Last Touch" sortKey="lastTouchAt" />
        <HeaderCell label="Order By" sortKey="anticipatedOrderDate" />
      </div>

      {/* Virtualized rows */}
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{ height: VIRTUAL_CONTAINER_HEIGHT }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: projects.length * VIRTUAL_ROW_HEIGHT, position: 'relative' }}>
          <div style={{ position: 'absolute', top: startIndex * VIRTUAL_ROW_HEIGHT, left: 0, right: 0 }}>
            {visible.map((p) => {
              const cust = customers.find((c) => c.id === p.customerId);
              const rep = reps.find((r) => r.id === p.salesRepId);
              const dormant = daysAgo(p.lastTouchAt) >= 90;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="grid w-full text-left border-b border-divider hover:bg-bg cursor-pointer items-center"
                  style={{ gridTemplateColumns: gridCols, height: VIRTUAL_ROW_HEIGHT }}
                >
                  <div className="px-3 text-fg-faint text-xs font-mono truncate">{p.opportunityId ?? p.id}</div>
                  <div className="px-3 font-medium text-fg text-sm truncate">{p.name}</div>
                  <div className="px-3 text-fg-muted text-sm truncate">{cust?.company ?? '—'}</div>
                  <div className="px-3 text-fg-muted text-xs truncate">{PROJECT_TYPES.find((t) => t.key === p.projectType)?.label ?? '—'}</div>
                  <div className="px-3">
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full font-medium border',
                      STAGE_HEADER_COLORS[p.opportunityStage ?? 'lead_qualification'],
                    )}>
                      {KANBAN_STAGES.find((s) => s.key === p.opportunityStage)?.label ?? '—'}
                    </span>
                  </div>
                  <div className="px-3 text-right font-medium text-fg text-sm">{fmt$(p.value)}</div>
                  <div className="px-3 text-fg-muted text-xs">{rep?.initials ?? '—'}</div>
                  <div className="px-3 text-fg-muted text-xs italic truncate">{p.nextStep ?? '—'}</div>
                  <div className={clsx('px-3 text-xs', dormant ? 'text-warning' : 'text-fg-muted')}>
                    {daysAgo(p.lastTouchAt)}d ago
                  </div>
                  <div className="px-3 text-fg-muted text-xs">{p.anticipatedOrderDate ?? '—'}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer — shows the scale handling explicitly */}
      <div className="px-3 py-2 text-xs text-fg-faint bg-bg border-t border-divider">
        Showing window of {visible.length} of {projects.length.toLocaleString()} projects — virtualized for scale.
      </div>
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

  const [view, setView] = useState<'kanban' | 'list' | 'insights'>('kanban');
  const [selected, setSelected] = useState<ExtendedProject | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [repFilter, setRepFilter] = useState<'mine' | 'all'>('mine');
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('active');
  const [dormantOnly, setDormantOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<PresetKey | null>(null);

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

  // Apply filters (regular chips) + preset (extra constraints on top)
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
      if (preset && !matchesPreset(p, preset)) return false;
      return true;
    });
  }, [projects, repFilter, currentRepId, typeFilter, statusFilter, dormantOnly, search, preset]);

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
          <button onClick={() => setView('insights')}
            className={clsx('px-3 py-1.5 text-sm flex items-center gap-1.5', view === 'insights' ? 'bg-accent text-white' : 'bg-surface text-fg-muted hover:bg-bg')}>
            <BarChart3 size={14} /> Insights
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

      {/* ── Smart filter presets ── one-tap views the rep can act on.
            Hidden in Insights view since filters don't apply there. */}
      {view !== 'insights' && (
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPreset(active ? null : p.key)}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                active
                  ? 'bg-accent text-white border-accent shadow-sm'
                  : 'bg-surface text-fg-muted border-divider hover:border-accent/40 hover:text-fg',
              )}
              title={p.description}
            >
              <p.icon size={12} className={active ? '' : p.iconClass} />
              {p.label}
            </button>
          );
        })}
        {preset && (
          <button
            onClick={() => setPreset(null)}
            className="text-xs text-fg-faint hover:text-fg-muted ml-1"
          >
            Clear preset
          </button>
        )}
      </div>
      )}

      {/* ── Filter chip row ── */}
      {view !== 'insights' && (
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
      )}

      {view === 'insights' ? (
        <InsightsView />
      ) : view === 'kanban' ? (
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
