import { useAppStore } from '../store/useAppStore';
import { DollarSign, Users, FolderOpen, Package, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

function StatCard({ label, value, icon: Icon, hint }: {
  label: string; value: string | number; icon: React.ElementType; hint?: string;
}) {
  return (
    <div className="group relative bg-surface rounded-xl border border-divider p-5 overflow-hidden hover:border-divider-strong transition-colors">
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-accent/5 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] text-fg-muted font-medium uppercase tracking-widest">{label}</p>
          <p className="text-3xl font-semibold text-fg mt-2 tracking-tight">{value}</p>
          {hint && <p className="text-xs text-fg-faint mt-1">{hint}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent-light">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

const STATUS_PILL: Record<string, string> = {
  Lead:   'bg-surface-2 text-fg-muted border border-divider',
  Active: 'bg-accent/15 text-accent-light border border-accent/30',
  Quoted: 'bg-warning/15 text-warning border border-warning/30',
  Won:    'bg-success/15 text-success border border-success/30',
  Lost:   'bg-danger/15 text-danger border border-danger/30',
};

const ORDER_STATUS_PILL: Record<string, string> = {
  Pending:   'bg-warning/15 text-warning border border-warning/30',
  Shipped:   'bg-accent/15 text-accent-light border border-accent/30',
  Delivered: 'bg-success/15 text-success border border-success/30',
  Cancelled: 'bg-danger/15 text-danger border border-danger/30',
};

export default function Dashboard() {
  const { projects, customers, sampleOrders, products } = useAppStore();

  const activeProjects = projects.filter((p) => p.status === 'Active' || p.status === 'Quoted');
  const pipeline = projects
    .filter((p) => p.status !== 'Lost')
    .reduce((sum, p) => sum + p.value, 0);
  const wonValue = projects
    .filter((p) => p.status === 'Won')
    .reduce((sum, p) => sum + p.value, 0);

  const recentProjects = [...projects]
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
    .slice(0, 6);

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pipeline" value={fmt(pipeline)} icon={DollarSign} hint={`${activeProjects.length} active`} />
        <StatCard label="Won YTD" value={fmt(wonValue)} icon={TrendingUp} hint="closed deals" />
        <StatCard label="Customers" value={customers.length} icon={Users} hint="in book" />
        <StatCard label="Products" value={products.length} icon={Package} hint="in catalog" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-divider overflow-hidden">
          <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-fg">Recent Projects</h2>
              <p className="text-xs text-fg-muted mt-0.5">Latest activity across your pipeline</p>
            </div>
            <FolderOpen size={16} className="text-fg-faint" />
          </div>
          <div className="divide-y divide-divider">
            {recentProjects.map((proj) => {
              const customer = customers.find((c) => c.id === proj.customerId);
              return (
                <div key={proj.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-surface-1 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-fg truncate">{proj.name}</p>
                    <p className="text-xs text-fg-muted mt-0.5">{customer?.company ?? '—'}</p>
                  </div>
                  <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-medium', STATUS_PILL[proj.status])}>
                    {proj.status}
                  </span>
                  <span className="text-sm font-semibold text-fg w-16 text-right tabular-nums">
                    {fmt(proj.value)}
                  </span>
                </div>
              );
            })}
            {recentProjects.length === 0 && (
              <p className="px-5 py-8 text-sm text-fg-muted text-center">No projects yet.</p>
            )}
          </div>
        </div>

        {/* Sample Orders summary */}
        <div className="bg-surface rounded-xl border border-divider overflow-hidden">
          <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-fg">Recent Samples</h2>
              <p className="text-xs text-fg-muted mt-0.5">Latest orders</p>
            </div>
            <Package size={16} className="text-fg-faint" />
          </div>
          <div className="divide-y divide-divider">
            {sampleOrders.slice(0, 5).map((o) => {
              const customer = customers.find((c) => c.id === o.customerId);
              return (
                <div key={o.id} className="px-5 py-3.5 hover:bg-surface-1 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-fg text-sm truncate">{customer?.company ?? '—'}</p>
                    <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0', ORDER_STATUS_PILL[o.status] ?? 'bg-surface-2 text-fg-muted border border-divider')}>
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted mt-1">{o.items.length} item(s) · {o.orderedDate}</p>
                </div>
              );
            })}
            {sampleOrders.length === 0 && (
              <p className="px-5 py-8 text-sm text-fg-muted text-center">No orders yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
