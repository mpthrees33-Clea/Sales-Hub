import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { X, MessageSquare } from 'lucide-react';
import type { Project, ProjectStatus } from '../../types';

const STATUSES: ProjectStatus[] = ['Lead','Active','Quoted','Won','Lost'];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Lead:   'bg-slate-100 text-slate-600',
  Active: 'bg-blue-100 text-blue-700',
  Quoted: 'bg-yellow-100 text-yellow-700',
  Won:    'bg-green-100 text-green-700',
  Lost:   'bg-red-100 text-red-600',
};

interface Props { project: Project; onClose: () => void; }

export default function ProjectDetailPanel({ project, onClose }: Props) {
  const { customers, sampleOrders, updateProject } = useAppStore();
  const [noteText, setNoteText] = useState('');
  const customer = customers.find((c) => c.id === project.customerId);
  const linkedOrders = sampleOrders.filter((o) => o.id && project.sampleOrderIds.includes(o.id));

  function addNote() {
    if (!noteText.trim()) return;
    const note = { id: `n-${Date.now()}`, date: new Date().toISOString().slice(0,10), text: noteText.trim(), author: 'You' };
    updateProject(project.id, { notes: [...project.notes, note] });
    setNoteText('');
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
        <h2 className="font-semibold text-slate-800 truncate mr-2">{project.name}</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 shrink-0"><X size={16} /></button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Customer chip */}
        {customer && (
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
              {customer.company[0]}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-slate-800 truncate">{customer.company}</p>
              <p className="text-xs text-slate-500">{customer.type}</p>
            </div>
          </div>
        )}

        {/* Status + Value */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={project.status}
              onChange={(e) => updateProject(project.id, { status: e.target.value as ProjectStatus })}
            >
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Value</label>
            <p className="text-sm font-semibold text-slate-800 px-2 py-1.5">${project.value.toLocaleString()}</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
          <p className="text-sm text-slate-700">{project.description}</p>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
          <div><span className="font-medium">Created:</span> {project.createdDate}</div>
          <div><span className="font-medium">Order by:</span> {project.anticipatedOrderDate ?? '—'}</div>
        </div>

        {/* Linked sample orders */}
        {linkedOrders.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Linked Samples</p>
            {linkedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-slate-50 rounded mb-1">
                <span className="text-slate-600">{o.orderedDate} · {o.items.length} item(s)</span>
                <span className={`px-1.5 py-0.5 rounded-full font-medium text-xs ${{
                  Pending:'bg-yellow-100 text-yellow-700',Processing:'bg-blue-100 text-blue-700',
                  Shipped:'bg-violet-100 text-violet-700',Delivered:'bg-green-100 text-green-700'
                }[o.status]}`}>{o.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
            <MessageSquare size={12} /> Notes
          </p>
          <div className="space-y-2 mb-3">
            {project.notes.length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
            {project.notes.map((n) => (
              <div key={n.id} className="text-xs bg-slate-50 rounded px-3 py-2">
                <p className="text-slate-700">{n.text}</p>
                <p className="text-slate-400 mt-1">{n.author} · {n.date}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add a note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <button onClick={addNote} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
