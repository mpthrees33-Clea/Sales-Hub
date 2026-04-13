import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, ChevronDown, ChevronRight, MapPin, Phone, Mail, FolderOpen } from 'lucide-react';
import type { Customer } from '../types';

const TYPE_COLORS: Record<string, string> = {
  Contractor: 'bg-orange-100 text-orange-700',
  Designer:   'bg-pink-100 text-pink-700',
  Architect:  'bg-indigo-100 text-indigo-700',
  Dealer:     'bg-teal-100 text-teal-700',
  Homeowner:  'bg-slate-100 text-slate-600',
};

const STATUS_COLORS: Record<string, string> = {
  Lead: 'bg-slate-100 text-slate-600',
  Active: 'bg-blue-100 text-blue-700',
  Quoted: 'bg-yellow-100 text-yellow-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
};

function CustomerRow({ customer }: { customer: Customer }) {
  const [expanded, setExpanded] = useState(false);
  const { projects } = useAppStore();
  const custProjects = projects.filter((p) => p.customerId === customer.id);
  const primary = customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];
  const defaultShip = customer.shipToAddresses.find((a) => a.isDefault) ?? customer.shipToAddresses[0];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{customer.company}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[customer.type]}`}>
              {customer.type}
            </span>
          </div>
          <p className="text-xs text-slate-500">{primary?.name} · {customer.billingCity}, {customer.billingState}</p>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">{custProjects.length} project(s)</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
          {/* Contacts */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contacts</p>
            {customer.contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm py-1">
                <div className="flex-1">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  {c.title && <span className="text-slate-400 ml-1">· {c.title}</span>}
                  {c.isPrimary && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1 rounded">Primary</span>}
                </div>
                <a href={`mailto:${c.email}`} className="text-slate-400 hover:text-blue-600"><Mail size={14} /></a>
                <a href={`tel:${c.phone}`} className="text-slate-400 hover:text-blue-600"><Phone size={14} /></a>
              </div>
            ))}
          </div>

          {/* Ship-to addresses */}
          {customer.shipToAddresses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Ship-To Addresses</p>
              {customer.shipToAddresses.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs text-slate-600 py-1">
                  <MapPin size={12} className="mt-0.5 text-slate-400 shrink-0" />
                  <span><strong>{a.label}:</strong> {a.address}, {a.city}, {a.state} {a.zip}</span>
                  {a.isDefault && <span className="bg-green-100 text-green-600 px-1 rounded">Default</span>}
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          {custProjects.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Projects</p>
              {custProjects.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                  <FolderOpen size={13} className="text-slate-400" />
                  <span className="flex-1 text-slate-700">{p.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                  <span className="text-xs text-slate-500">${p.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {customer.notes && (
            <p className="text-xs text-slate-500 italic">{customer.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CRMPage() {
  const { customers } = useAppStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const types = ['All', 'Contractor', 'Designer', 'Architect', 'Dealer', 'Homeowner'];

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.company.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) ||
      c.contacts.some((ct) => ct.name.toLowerCase().includes(q));
    const matchType = typeFilter === 'All' || c.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} customer(s)</p>

      <div className="space-y-2">
        {filtered.map((c) => <CustomerRow key={c.id} customer={c} />)}
      </div>
    </div>
  );
}
