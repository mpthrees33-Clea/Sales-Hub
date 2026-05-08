import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { X } from 'lucide-react';

interface Props { onClose: () => void; }

export default function NewProjectModal({ onClose }: Props) {
  const { customers, addProject } = useAppStore();
  const [form, setForm] = useState({
    customerId: '',
    name: '',
    description: '',
    value: '',
    anticipatedOrderDate: '',
    status: 'Lead' as const,
  });
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.name || !form.description || !form.value || !form.anticipatedOrderDate) {
      setError('All fields are required.');
      return;
    }
    addProject({
      id: `pr-${Date.now()}`,
      customerId: form.customerId,
      name: form.name,
      description: form.description,
      value: parseFloat(form.value),
      anticipatedOrderDate: form.anticipatedOrderDate,
      status: form.status,
      productIds: [],
      sampleOrderIds: [],
      notes: [],
      createdDate: new Date().toISOString().slice(0, 10),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
          <h2 className="font-semibold text-fg">New Project</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-1"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          {error && <p className="text-xs text-danger bg-danger/10 px-3 py-2 rounded">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Customer *</label>
            <select
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              value={form.customerId}
              onChange={(e) => set('customerId', e.target.value)}
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Project Name *</label>
            <input
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Buckhead Tower Lobby"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Description *</label>
            <textarea
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              rows={2} value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder="Scope, location, key details…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Value ($) *</label>
              <input
                type="number" min="0" step="100"
                className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                value={form.value} onChange={(e) => set('value', e.target.value)}
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Anticipated Order *</label>
              <input
                type="date"
                className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                value={form.anticipatedOrderDate} onChange={(e) => set('anticipatedOrderDate', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Status</label>
            <select
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              value={form.status} onChange={(e) => set('status', e.target.value as any)}
            >
              {['Lead','Active','Bidding','Won','Lost'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted rounded-lg hover:bg-surface-1">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim">Create Project</button>
          </div>
        </form>
      </div>
    </div>
  );
}
