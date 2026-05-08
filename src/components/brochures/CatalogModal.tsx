import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { X, ChevronRight, ChevronLeft, ArrowUp, ArrowDown } from 'lucide-react';
import type { Catalog } from '../../types';

interface Props { catalog?: Catalog; onClose: () => void; }

const AUDIENCES = ['Architect','Designer','Contractor','General'] as const;

export default function CatalogModal({ catalog, onClose }: Props) {
  const { brochures, addCatalog, updateCatalog } = useAppStore();
  const [form, setForm] = useState({
    name: catalog?.name ?? '',
    version: catalog?.version ?? '1.0',
    description: catalog?.description ?? '',
    targetAudience: catalog?.targetAudience ?? 'General',
    isTemplate: catalog?.isTemplate ?? true,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>(catalog?.brochureIds ?? []);
  const [error, setError] = useState('');

  function set(k: string, v: string | boolean) { setForm((f) => ({ ...f, [k]: v })); }

  const available = brochures.filter((b) => !selectedIds.includes(b.id));
  const selected = selectedIds.map((id) => brochures.find((b) => b.id === id)).filter(Boolean) as typeof brochures;

  function add(id: string) { setSelectedIds((ids) => [...ids, id]); }
  function remove(id: string) { setSelectedIds((ids) => ids.filter((i) => i !== id)); }
  function move(id: string, dir: -1 | 1) {
    setSelectedIds((ids) => {
      const i = ids.indexOf(id);
      if (i < 0) return ids;
      const next = i + dir;
      if (next < 0 || next >= ids.length) return ids;
      const arr = [...ids];
      [arr[i], arr[next]] = [arr[next], arr[i]];
      return arr;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setError('Name is required.'); return; }
    if (catalog) {
      updateCatalog(catalog.id, { ...form, brochureIds: selectedIds, modifiedDate: new Date().toISOString().slice(0,10), targetAudience: form.targetAudience as any });
    } else {
      addCatalog({
        id: `cat-${Date.now()}`,
        ...form,
        targetAudience: form.targetAudience as any,
        brochureIds: selectedIds,
        createdDate: new Date().toISOString().slice(0,10),
        modifiedDate: new Date().toISOString().slice(0,10),
        tags: [],
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
          <h2 className="font-semibold text-fg">{catalog ? 'Edit Catalog' : 'New Catalog'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-1"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-xs text-danger bg-danger/10 px-3 py-2 rounded">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Name *</label>
              <input className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Version</label>
              <input className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                value={form.version} onChange={(e) => set('version', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Audience</label>
              <select className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                value={form.targetAudience} onChange={(e) => set('targetAudience', e.target.value)}>
                {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="isTemplate" checked={form.isTemplate}
                onChange={(e) => set('isTemplate', e.target.checked)} className="rounded" />
              <label htmlFor="isTemplate" className="text-sm text-fg-muted">Is Template</label>
            </div>
          </div>

          {/* Brochure picker */}
          <div>
            <p className="text-xs font-medium text-fg-muted mb-2">Brochures</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Available */}
              <div>
                <p className="text-xs text-fg-faint mb-1">Available ({available.length})</p>
                <div className="border border-divider rounded-lg h-48 overflow-y-auto">
                  {available.map((b) => (
                    <button key={b.id} type="button" onClick={() => add(b.id)}
                      className="w-full text-left flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/10 border-b border-divider last:border-0">
                      <span className="truncate">{b.name}</span>
                      <ChevronRight size={12} className="text-fg-faint shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
              {/* Selected */}
              <div>
                <p className="text-xs text-fg-faint mb-1">Selected ({selected.length})</p>
                <div className="border border-divider rounded-lg h-48 overflow-y-auto">
                  {selected.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-1 px-2 py-1.5 text-xs border-b border-divider last:border-0">
                      <span className="flex-1 truncate">{b.name}</span>
                      <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0} className="p-0.5 text-fg-faint hover:text-fg-muted disabled:opacity-30"><ArrowUp size={11} /></button>
                      <button type="button" onClick={() => move(b.id, 1)} disabled={i === selected.length - 1} className="p-0.5 text-fg-faint hover:text-fg-muted disabled:opacity-30"><ArrowDown size={11} /></button>
                      <button type="button" onClick={() => remove(b.id)} className="p-0.5 text-danger/70 hover:text-danger"><ChevronLeft size={11} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted rounded-lg hover:bg-surface-1">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim">
              {catalog ? 'Save Changes' : 'Create Catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
