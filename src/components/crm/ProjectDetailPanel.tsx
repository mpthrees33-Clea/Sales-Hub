import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { X, MessageSquare } from 'lucide-react';
import type { Project, ProjectStatus } from '../../types';

const STATUSES: ProjectStatus[] = ['Lead','Active','Bidding','Won','Lost'];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Lead:   'bg-surface-1 text-fg-muted',
  Active: 'bg-accent/15 text-accent-light',
  Bidding: 'bg-warning/15 text-warning',
  Won:    'bg-success/15 text-success',
  Lost:   'bg-danger/15 text-danger',
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
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-surface border-l border-divider shadow-xl flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider sticky top-0 bg-surface">
        <h2 className="font-semibold text-fg truncate mr-2">{project.name}</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface-1 shrink-0"><X size={16} /></button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Customer chip */}
        {customer && (
          <div className="flex items-center gap-2 bg-bg rounded-lg px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-accent text-white text-xs flex items-center justify-center font-bold shrink-0">
              {customer.company[0]}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-fg truncate">{customer.company}</p>
              <p className="text-xs text-fg-muted">{customer.type}</p>
            </div>
          </div>
        )}

        {/* Status + Value */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Status</label>
            <select
              className="w-full text-sm border border-divider rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
              value={project.status}
              onChange={(e) => updateProject(project.id, { status: e.target.value as ProjectStatus })}
            >
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Value</label>
            <p className="text-sm font-semibold text-fg px-2 py-1.5">${project.value.toLocaleString()}</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Description</label>
          <p className="text-sm text-fg">{project.description}</p>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 text-xs text-fg-muted">
          <div><span className="font-medium">Created:</span> {project.createdDate}</div>
          <div><span className="font-medium">Order by:</span> {project.anticipatedOrderDate ?? '—'}</div>
        </div>

        {/* Linked sample orders */}
        {linkedOrders.length > 0 && (
          <div>
            <p className="text-xs font-medium text-fg-muted mb-1">Linked Samples</p>
            {linkedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-bg rounded mb-1">
                <span className="text-fg-muted">{o.orderedDate} · {o.items.length} item(s)</span>
                <span className={`px-1.5 py-0.5 rounded-full font-medium text-xs ${{
                  Pending:'bg-warning/15 text-warning',Processing:'bg-accent/15 text-accent-light',
                  Shipped:'bg-accent/15 text-accent-light',Delivered:'bg-success/15 text-success'
                }[o.status]}`}>{o.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-xs font-medium text-fg-muted mb-2 flex items-center gap-1">
            <MessageSquare size={12} /> Notes
          </p>
          <div className="space-y-2 mb-3">
            {project.notes.length === 0 && <p className="text-xs text-fg-faint">No notes yet.</p>}
            {project.notes.map((n) => (
              <div key={n.id} className="text-xs bg-bg rounded px-3 py-2">
                <p className="text-fg">{n.text}</p>
                <p className="text-fg-faint mt-1">{n.author} · {n.date}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Add a note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <button onClick={addNote} className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
