import { useState, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { X, Upload } from 'lucide-react';

const fileStore: Record<string, string> = {};
export const getFile = (id: string) => fileStore[id];

interface Props { onClose: () => void; }

const CATEGORIES = ['LVP','SPC','Hardwood','Engineered Hardwood','Laminate','Carpet','Tile','Cork','Bamboo','Area Rug','Other'];

export default function UploadModal({ onClose }: Props) {
  const { addBrochure } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', brand: '', category: 'LVP', tags: '', pageCount: '', description: '' });
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !form.name) set('name', f.name.replace(/\.[^.]+$/, ''));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.brand || !form.category) { setError('Name, brand, and category required.'); return; }
    const id = `b-${Date.now()}`;
    if (file) fileStore[id] = URL.createObjectURL(file);
    addBrochure({
      id,
      name: form.name,
      brand: form.brand,
      category: form.category,
      fileName: file?.name ?? `${form.name}.pdf`,
      fileSize: file?.size,
      uploadDate: new Date().toISOString().slice(0, 10),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      description: form.description || undefined,
      pageCount: form.pageCount ? parseInt(form.pageCount) : undefined,
      productIds: [],
      hasFile: !!file,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Upload Brochure</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

          {/* File drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
          >
            <Upload size={20} className="mx-auto text-slate-400 mb-1" />
            <p className="text-sm text-slate-500">{file ? file.name : 'Click to choose PDF or image'}</p>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={onFileChange} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Brand *</label>
              <input className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Shaw" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
              <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Page Count</label>
              <input type="number" min="1"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.pageCount} onChange={(e) => set('pageCount', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags (comma-separated)</label>
            <input className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="lvp, waterproof, commercial" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Upload</button>
          </div>
        </form>
      </div>
    </div>
  );
}
