import { useAppStore } from '../store/useAppStore';
import { DollarSign, Users, FolderOpen, Package } from 'lucide-react';

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Lead: 'bg-slate-100 text-slate-600',
  Active: 'bg-blue-100 text-blue-700',
  Quoted: 'bg-yellow-100 text-yellow-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
};

export default function Dashboard() {
  const { projects, customers, sampleOrders, products } = useAppStore();

  const activeProjects = projects.filter((p) => p.status === 'Active' || p.status === 'Quoted');
  const pipeline = projects
    .filter((p) => p.status !== 'Lost')
    .reduce((sum, p) => sum + p.value, 0);
  const unread = 0; // placeholder

  const recentProjects = [...projects]
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
    .slice(0, 6);

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pipeline Value" value={fmt(pipeline)} icon={DollarSign} color="bg-blue-500" />
        <StatCard label="Active Projects" value={activeProjects.length} icon={FolderOpen} color="bg-green-500" />
        <StatCard label="Customers" value={customers.length} icon={Users} color="bg-violet-500" />
        <StatCard label="Products" value={products.length} icon={Package} color="bg-orange-500" />
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Recent Projects</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {recentProjects.map((proj) => {
            const customer = customers.find((c) => c.id === proj.customerId);
            return (
              <div key={proj.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{proj.name}</p>
                  <p className="text-xs text-slate-500">{customer?.company ?? '—'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[proj.status]}`}>
                  {proj.status}
                </span>
                <span className="text-sm font-semibold text-slate-700 w-16 text-right">
                  {fmt(proj.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sample Orders summary */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Recent Sample Orders</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {sampleOrders.slice(0, 4).map((o) => {
            const customer = customers.find((c) => c.id === o.customerId);
            return (
              <div key={o.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{customer?.company ?? '—'}</p>
                  <p className="text-xs text-slate-500">{o.items.length} item(s) · {o.orderedDate}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {o.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
