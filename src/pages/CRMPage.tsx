import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Plus, List, LayoutGrid, X } from 'lucide-react';
import type { Project, ProjectStatus } from '../types';
import NewProjectModal from '../components/crm/NewProjectModal';
import ProjectDetailPanel from '../components/crm/ProjectDetailPanel';

const STATUSES: ProjectStatus[] = ['Lead', 'Active', 'Quoted', 'Won', 'Lost'];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Lead:   'border-slate-300 bg-slate-50 text-slate-600',
  Active: 'border-blue-300 bg-blue-50 text-blue-700',
  Quoted: 'border-yellow-300 bg-yellow-50 text-yellow-700',
  Won:    'border-green-300 bg-green-50 text-green-700',
  Lost:   'border-red-300 bg-red-50 text-red-600',
};

const STATUS_HEADER: Record<ProjectStatus, string> = {
  Lead:   'bg-slate-100 text-slate-700',
  Active: 'bg-blue-100 text-blue-800',
  Quoted: 'bg-yellow-100 text-yellow-800',
  Won:    'bg-green-100 text-green-800',
  Lost:   'bg-red-100 text-red-700',
};

function fmt(n: number) { return `$${n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n}`; }
function daysAgo(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

function KanbanCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const { customers } = useAppStore();
  const customer = customers.find((c) => c.id === project.customerId);
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
    >
      <p className="font-medium text-slate-800 text-sm leading-tight">{project.name}</p>
      <p className="text-xs text-slate-500 mt-1">{customer?.company ?? '—'}</p>
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs font-semibold text-slate-700">{fmt(project.value)}</span>
        <span className="text-xs text-slate-400">{daysAgo(project.createdDate)}d ago</span>
      </div>
      {project.anticipatedOrderDate && (
        <p className="text-xs text-slate-400 mt-1">→ {project.anticipatedOrderDate}</p>
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
            <div className="space-y-2 p-2 bg-slate-100 rounded-b-lg min-h-[120px]">
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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Project</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-right">Value</th>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Anticipated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((p) => {
            const cust = customers.find((c) => c.id === p.customerId);
            return (
              <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(p)}>
                <td className="px-3 py-2 text-slate-600">{cust?.company ?? '—'}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-700">{fmt(p.value)}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{p.createdDate}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{p.anticipatedOrderDate ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CRMPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selected, setSelected] = useState<Project | null>(null);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <LayoutGrid size={14} /> Kanban
          </button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <List size={14} /> List
          </button>
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
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
