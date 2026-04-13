import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';
import type { SampleOrderStatus } from '../types';

const STATUS_ICON: Record<SampleOrderStatus, React.ReactNode> = {
  Pending:    <Clock size={14} className="text-yellow-500" />,
  Processing: <Package size={14} className="text-blue-500" />,
  Shipped:    <Truck size={14} className="text-violet-500" />,
  Delivered:  <CheckCircle size={14} className="text-green-500" />,
};

const STATUS_COLORS: Record<SampleOrderStatus, string> = {
  Pending:    'bg-yellow-100 text-yellow-700',
  Processing: 'bg-blue-100 text-blue-700',
  Shipped:    'bg-violet-100 text-violet-700',
  Delivered:  'bg-green-100 text-green-700',
};

export default function SamplesPage() {
  const { sampleOrders, customers, updateSampleOrder } = useAppStore();
  const [filter, setFilter] = useState<SampleOrderStatus | 'All'>('All');

  const filtered = sampleOrders.filter((o) => filter === 'All' || o.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Pending', 'Processing', 'Shipped', 'Delivered'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((order) => {
          const customer = customers.find((c) => c.id === order.customerId);
          return (
            <div key={order.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-800">{customer?.company ?? '—'}</p>
                  <p className="text-xs text-slate-500">
                    {order.shippingName} · {order.shippingCity}, {order.shippingState}
                  </p>
                  <p className="text-xs text-slate-400">Ordered: {order.orderedDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  {STATUS_ICON[order.status]}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="mt-3 space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-5 h-5 bg-slate-100 rounded text-center leading-5 font-medium shrink-0">
                      {item.quantity}
                    </span>
                    <span>{item.productName}</span>
                    {item.privateLabelName && (
                      <span className="text-slate-400">({item.privateLabelName})</span>
                    )}
                  </div>
                ))}
              </div>

              {order.trackingNumber && (
                <p className="text-xs text-blue-600 mt-2">Track: {order.trackingNumber}</p>
              )}

              {/* Status advance */}
              <div className="mt-3 flex gap-2">
                {order.status !== 'Delivered' && (
                  <button
                    onClick={() => {
                      const next: Record<SampleOrderStatus, SampleOrderStatus> = {
                        Pending: 'Processing', Processing: 'Shipped', Shipped: 'Delivered', Delivered: 'Delivered',
                      };
                      updateSampleOrder(order.id, { status: next[order.status] });
                    }}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Advance Status
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No sample orders for this filter.</p>
        )}
      </div>
    </div>
  );
}
