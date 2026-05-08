import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Plus, List, LayoutGrid } from 'lucide-react';
import type { Project, ProjectStatus } from '../types';
import NewProjectModal from '../components/crm/NewProjectModal';
import ProjectDetailPanel from '../components/crm/ProjectDetailPanel';

const STATUSES: ProjectStatus[] = ['Lead', 'Active', 'Bidding', 'Won', 'Lost'];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Lead:   'border-divider-strong bg-bg text-fg-muted',
  Active: 'border-accent/40 bg-accent/10 text-accent-light',
  Bidding: 'border-warning/40 bg-warning/10 text-warning',
  Won:    'border-success/40 bg-success/10 text-success',
  Lost:   'border-danger/40 bg-danger/10 text-danger',
};

const STATUS_HEADER: Record<ProjectStatus, string> = {
  Lead:   'bg-surface-1 text-fg',
  Active: 'bg-accent/15 text-accent-light',
  Bidding: 'bg-warning/15 text-warning',
  Won:    'bg-success/15 text-success',
  Lost:   'bg-danger/15 text-danger',
};

function fmt(n: number) { return `$${n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n}`; }
function daysAgo(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

function KanbanCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const { customers } = useAppStore();
  const customer = customers.find((c) => c.id === project.customerId);
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface rounded-lg border border-divider p-3 shadow-none hover:shadow-md hover:border-accent/40 transition-all"
    >
      <p className="font-medium text-fg text-sm leading-tight">{project.name}</p>
      <p className="text-xs text-fg-muted mt-1">{customer?.company ?? '—'}</p>
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs font-semibold text-fg">{fmt(project.value)}</span>
        <span className="text-xs text-fg-faint">{daysAgo(project.createdDate)}d ago</span>
      </div>
      {project.anticipatedOrderDate && (
        <p className="text-xs text-fg-faint mt-1">→ {project.anticipatedOrderDate}</p>
      )}
    </button>
  );
}

function KanbanBoard({ onSelect }: { onSelect: (p: Project) => void }) {
  const { projects } = useAppStore();
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUSES.map((status) => {
        const cols = projects.filter((p) => p.status === status);
        const total = cols.reduce((s, p) => s + p.value, 0);
        return (
          <div key={status} className="flex-shrink-0 w-56">
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg font-semibold text-xs ${STATUS_HEADER[status]}`}>
              <span>{status}</span>
              <span>{cols.length} · {fmt(total)}</span>
            </div>
            <div className="space-y-2 p-2 bg-surface-1 rounded-b-lg min-h-[120px]">
              {cols.map((p) => <KanbanCard key={p.id} project={p} onClick={() => onSelect(p)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ onSelect }: { onSelect: (p: Project) => void }) {
  const { projects, customers } = useAppStore();
  const sorted = [...projects].sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  return (
    <div className="overflow-x-auto rounded-lg border border-divider bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-bg text-xs text-fg-muted uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Project</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-right">Value</th>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Anticipated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {sorted.map((p) => {
            const cust = customers.find((c) => c.id === p.customerId);
            return (
              <tr key={p.id} className="hover:bg-bg cursor-pointer" onClick={() => onSelect(p)}>
                <td className="px-3 py-2 text-fg-muted">{cust?.company ?? '—'}</td>
                <td className="px-3 py-2 font-medium text-fg">{p.name}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium text-fg">{fmt(p.value)}</td>
                <td className="px-3 py-2 text-fg-muted text-xs">{p.createdDate}</td>
                <td className="px-3 py-2 text-fg-muted text-xs">{p.anticipatedOrderDate ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CRMPage() {
  const { projects, selectedProjectId, setSelectedProjectId } = useAppStore();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selected, setSelected] = useState<Project | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Honor cross-page nav: Dashboard sets selectedProjectId, we open the panel here
  useEffect(() => {
    if (!selectedProjectId) return;
    const p = projects.find((x) => x.id === selectedProjectId);
    if (p) setSelected(p);
    setSelectedProjectId(null);
  }, [selectedProjectId, projects, setSelectedProjectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-divider overflow-hidden">
          <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${view === 'kanban' ? 'bg-accent text-white' : 'bg-surface text-fg-muted hover:bg-bg'}`}>
            <LayoutGrid size={14} /> Kanban
          </button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${view === 'list' ? 'bg-accent text-white' : 'bg-surface text-fg-muted hover:bg-bg'}`}>
            <List size={14} /> List
          </button>
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim">
          <Plus size={14} /> New Project
        </button>
      </div>

      {view === 'kanban'
        ? <KanbanBoard onSelect={setSelected} />
        : <ListView onSelect={setSelected} />
      }

      {selected && (
        <ProjectDetailPanel project={selected} onClose={() => setSelected(null)} />
      )}

      {showModal && (
        <NewProjectModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
