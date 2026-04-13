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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{catalog ? 'Edit Catalog' : 'New Catalog'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Version</label>
              <input className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.version} onChange={(e) => set('version', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Audience</label>
              <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.targetAudience} onChange={(e) => set('targetAudience', e.target.value)}>
                {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="isTemplate" checked={form.isTemplate}
                onChange={(e) => set('isTemplate', e.target.checked)} className="rounded" />
              <label htmlFor="isTemplate" className="text-sm text-slate-600">Is Template</label>
            </div>
          </div>

          {/* Brochure picker */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Brochures</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Available */}
              <div>
                <p className="text-xs text-slate-400 mb-1">Available ({available.length})</p>
                <div className="border border-slate-200 rounded-lg h-48 overflow-y-auto">
                  {available.map((b) => (
                    <button key={b.id} type="button" onClick={() => add(b.id)}
                      className="w-full text-left flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-50 border-b border-slate-50 last:border-0">
                      <span className="truncate">{b.name}</span>
                      <ChevronRight size={12} className="text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
              {/* Selected */}
              <div>
                <p className="text-xs text-slate-400 mb-1">Selected ({selected.length})</p>
                <div className="border border-slate-200 rounded-lg h-48 overflow-y-auto">
                  {selected.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-1 px-2 py-1.5 text-xs border-b border-slate-50 last:border-0">
                      <span className="flex-1 truncate">{b.name}</span>
                      <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowUp size={11} /></button>
                      <button type="button" onClick={() => move(b.id, 1)} disabled={i === selected.length - 1} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowDown size={11} /></button>
                      <button type="button" onClick={() => remove(b.id)} className="p-0.5 text-red-400 hover:text-red-600"><ChevronLeft size={11} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {catalog ? 'Save Changes' : 'Create Catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
