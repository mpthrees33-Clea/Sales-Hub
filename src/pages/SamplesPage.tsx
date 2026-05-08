import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, Plus, Minus, X as XIcon, ChevronDown } from 'lucide-react';
import type { SampleOrderItem, SampleOrderStatus } from '../types';

const STATUS_COLORS: Record<SampleOrderStatus, string> = {
  Pending:    'bg-warning/15 text-warning',
  Processing: 'bg-accent/15 text-accent-light',
  Shipped:    'bg-accent/15 text-accent-light',
  Delivered:  'bg-success/15 text-success',
};

function NewOrderForm({ onSubmit }: { onSubmit: () => void }) {
  const { customers, projects, products, addSampleOrder, lookupProductByAnyName } = useAppStore();
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [items, setItems] = useState<SampleOrderItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [shipName, setShipName] = useState('');
  const [shipAddr, setShipAddr] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('GA');
  const [shipZip, setShipZip] = useState('');

  const customer = customers.find((c) => c.id === customerId);
  const custProjects = projects.filter((p) => p.customerId === customerId);
  const searchResults = productSearch.length >= 2 ? products.filter((p) => {
    const q = productSearch.toLowerCase();
    return p.trinityName.toLowerCase().includes(q) || p.trinitySku.toLowerCase().includes(q) ||
      p.privateLabels.some((pl) => pl.brand.toLowerCase().includes(q) || pl.productName.toLowerCase().includes(q) || pl.sku.toLowerCase().includes(q));
  }).slice(0, 6) : [];

  function selectCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    const def = c?.shipToAddresses.find((a) => a.isDefault) ?? c?.shipToAddresses[0];
    if (c) { setShipName(c.name); }
    if (def) { setShipAddr(def.address); setShipCity(def.city); setShipState(def.state); setShipZip(def.zip); }
  }

  function addItem(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p || items.find((i) => i.productId === productId)) return;
    setItems((prev) => [...prev, { productId, productName: p.trinityName, quantity: 1 }]);
    setProductSearch('');
  }

  function updateQty(productId: string, delta: number) {
    setItems((prev) => prev.map((i) => i.productId === productId
      ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }

  function removeItem(productId: string) { setItems((prev) => prev.filter((i) => i.productId !== productId)); }

  function submit() {
    if (!customerId || !projectId || items.length === 0) return;
    addSampleOrder({
      id: `so-${Date.now()}`,
      customerId, projectId, items, status: 'Pending',
      orderedDate: new Date().toISOString().slice(0, 10),
      shippingName: shipName, shippingAddress: shipAddr,
      shippingCity: shipCity, shippingState: shipState, shippingZip: shipZip,
    });
    onSubmit();
  }

  return (
    <div className="bg-surface rounded-lg border border-divider p-4 space-y-4">
      <h3 className="font-semibold text-fg text-sm">New Sample Order</h3>

      {/* Step 1 — Customer */}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">1. Customer</label>
        <select className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          value={customerId} onChange={(e) => selectCustomer(e.target.value)}>
          <option value="">Select customer…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
        {customer && customer.shipToAddresses.length > 1 && (
          <select className="w-full mt-1 text-xs border border-divider rounded-lg px-3 py-2"
            onChange={(e) => {
              const a = customer.shipToAddresses.find((x) => x.id === e.target.value);
              if (a) { setShipAddr(a.address); setShipCity(a.city); setShipState(a.state); setShipZip(a.zip); }
            }}>
            {customer.shipToAddresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.address}</option>)}
          </select>
        )}
      </div>

      {/* Step 2 — Project */}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">2. Project</label>
        <select className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!customerId}>
          <option value="">Select project…</option>
          {custProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Step 3 — Products */}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">3. Products</label>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-fg-faint" />
          <input className="w-full pl-8 pr-3 py-2 text-sm border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Search by any name or brand…" value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)} />
        </div>
        {searchResults.length > 0 && (
          <div className="border border-divider rounded-lg mt-1 divide-y divide-divider max-h-40 overflow-y-auto">
            {searchResults.map((p) => (
              <button key={p.id} type="button" onClick={() => addItem(p.id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10">
                <span className="font-medium text-fg">{p.trinityName}</span>
                <span className="text-fg-faint ml-2">({p.privateLabels.map((pl) => `${pl.brand} ${pl.productName}`).join(', ')})</span>
              </button>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="mt-2 space-y-1">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-2 text-xs bg-bg rounded px-2 py-1.5">
                <span className="flex-1 font-medium text-fg">{item.productName}</span>
                <button onClick={() => updateQty(item.productId, -1)} className="p-0.5 text-fg-faint hover:text-fg-muted"><Minus size={12} /></button>
                <span className="w-5 text-center font-medium">{item.quantity}</span>
                <button onClick={() => updateQty(item.productId, 1)} className="p-0.5 text-fg-faint hover:text-fg-muted"><Plus size={12} /></button>
                <button onClick={() => removeItem(item.productId)} className="p-0.5 text-danger/80 hover:text-danger"><XIcon size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 4 — Shipping */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-fg-muted">4. Shipping</label>
        <input className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Ship to name" value={shipName} onChange={(e) => setShipName(e.target.value)} />
        <input className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Address" value={shipAddr} onChange={(e) => setShipAddr(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <input className="col-span-1 text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="City" value={shipCity} onChange={(e) => setShipCity(e.target.value)} />
          <input className="text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="ST" value={shipState} onChange={(e) => setShipState(e.target.value)} maxLength={2} />
          <input className="text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="ZIP" value={shipZip} onChange={(e) => setShipZip(e.target.value)} />
        </div>
      </div>

      <button onClick={submit}
        disabled={!customerId || !projectId || items.length === 0}
        className="w-full py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed">
        Submit Order
      </button>
    </div>
  );
}

export default function SamplesPage() {
  const { sampleOrders, customers, updateSampleOrder } = useAppStore();
  const [filter, setFilter] = useState<SampleOrderStatus | 'All'>('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit() { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }

  const filtered = [...sampleOrders]
    .filter((o) => filter === 'All' || o.status === filter)
    .sort((a, b) => b.orderedDate.localeCompare(a.orderedDate));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form — left 2/5 */}
      <div className="lg:col-span-2">
        {success && (
          <div className="mb-3 px-3 py-2 bg-success/15 text-success text-sm rounded-lg font-medium">
            Order submitted!
          </div>
        )}
        <NewOrderForm onSubmit={handleSubmit} />
      </div>

      {/* History — right 3/5 */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(['All','Pending','Processing','Shipped','Delivered'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${filter === s ? 'bg-accent text-white border-accent' : 'bg-surface text-fg-muted border-divider hover:border-divider-strong'}`}>
              {s}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((order) => {
            const customer = customers.find((c) => c.id === order.customerId);
            const isExpanded = expanded === order.id;
            return (
              <div key={order.id} className="bg-surface rounded-lg border border-divider overflow-hidden">
                <button className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-bg"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}>
                  <ChevronDown size={14} className={`text-fg-faint transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-fg">{customer?.company ?? '—'}</p>
                    <p className="text-xs text-fg-faint">{order.orderedDate} · {order.items.length} item(s)</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-divider bg-bg space-y-2">
                    <div className="mt-2 space-y-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex gap-2 text-xs text-fg-muted">
                          <span className="w-5 h-5 bg-surface-2 rounded text-center leading-5 font-medium shrink-0">{item.quantity}</span>
                          <span>{item.productName}</span>
                          {item.privateLabelName && <span className="text-fg-faint">({item.privateLabelName})</span>}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-fg-muted">{order.shippingName} · {order.shippingAddress}, {order.shippingCity}, {order.shippingState} {order.shippingZip}</p>
                    {order.trackingNumber && <p className="text-xs text-accent-light">Track: {order.trackingNumber}</p>}
                    {order.status !== 'Delivered' && (
                      <button onClick={() => {
                        const next: Record<SampleOrderStatus, SampleOrderStatus> = { Pending:'Processing', Processing:'Shipped', Shipped:'Delivered', Delivered:'Delivered' };
                        updateSampleOrder(order.id, { status: next[order.status] });
                      }} className="text-xs px-3 py-1 bg-accent text-white rounded hover:bg-accent-dim">
                        Advance Status
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-fg-faint text-center py-8">No orders.</p>}
        </div>
      </div>
    </div>
  );
}
