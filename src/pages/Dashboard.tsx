import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { DollarSign, Users, FolderOpen, Package, FileText, Receipt, Settings as SettingsIcon, X } from 'lucide-react';
import clsx from 'clsx';
import type { AppSettings } from '../types';

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
  Lead:    'bg-surface-2 text-fg-muted border border-divider',
  Active:  'bg-accent/15 text-accent-light border border-accent/30',
  Bidding: 'bg-warning/15 text-warning border border-warning/30',
  Won:     'bg-success/15 text-success border border-success/30',
  Lost:    'bg-danger/15 text-danger border border-danger/30',
};

const ORDER_STATUS_PILL: Record<string, string> = {
  Pending:   'bg-warning/15 text-warning border border-warning/30',
  Shipped:   'bg-accent/15 text-accent-light border border-accent/30',
  Delivered: 'bg-success/15 text-success border border-success/30',
  Cancelled: 'bg-danger/15 text-danger border border-danger/30',
};

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
}

// Inclusive: returns true if iso date string falls within [start, end]
function inRange(iso: string | undefined, start: Date, end: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= start && d <= end;
}

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0 = Sunday
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}
function startOfMonth(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const hit = target > 0 && value >= target;
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            hit ? 'bg-success' : 'bg-accent',
          )}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-fg-faint tabular-nums">
        <span>{pct}% of {fmt(target)}</span>
        <span>{target > 0 ? `${fmt(target - value)} to go` : 'no target set'}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-fg-muted">{label}</span>
        <span className="text-lg font-semibold text-fg tabular-nums">{fmt(value)}</span>
      </div>
      <ProgressBar value={value} target={target} />
    </div>
  );
}

function PerformanceCard({
  title, icon: Icon, weekValue, weekTarget, monthValue, monthTarget,
}: {
  title: string; icon: React.ElementType;
  weekValue: number; weekTarget: number;
  monthValue: number; monthTarget: number;
}) {
  return (
    <div className="bg-surface rounded-xl border border-divider p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-light">
            <Icon size={16} />
          </div>
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
        </div>
      </div>
      <MetricRow label="This week" value={weekValue} target={weekTarget} />
      <MetricRow label="This month" value={monthValue} target={monthTarget} />
    </div>
  );
}

function SettingsModal({ initial, onSave, onClose }: {
  initial: AppSettings; onSave: (s: AppSettings) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<AppSettings>(initial);
  const set = (k: keyof AppSettings, v: string) =>
    setForm((f) => ({ ...f, [k]: Math.max(0, parseFloat(v) || 0) }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
    onClose();
  }

  const Field = ({ k, label }: { k: keyof AppSettings; label: string }) => (
    <div>
      <label className="block text-xs font-medium text-fg-muted mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-fg-faint text-sm">$</span>
        <input
          type="number" min="0" step="1000"
          className="w-full pl-7 pr-3 py-2 text-sm border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          value={form[k]}
          onChange={(e) => set(k, e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
          <h2 className="font-semibold text-fg">Budget Targets</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-1"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">Sales Created</p>
            <div className="grid grid-cols-2 gap-3">
              <Field k="weeklySalesTarget" label="Weekly target" />
              <Field k="monthlySalesTarget" label="Monthly target" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-2">Invoiced</p>
            <div className="grid grid-cols-2 gap-3">
              <Field k="weeklyInvoiceTarget" label="Weekly target" />
              <Field k="monthlyInvoiceTarget" label="Monthly target" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted rounded-lg hover:bg-surface-1">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, customers, sampleOrders, products, settings, updateSettings, setSelectedProjectId } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  // Sales Created = total $ of projects with createdDate in window
  const salesCreatedWeek = projects
    .filter((p) => inRange(p.createdDate, weekStart, now))
    .reduce((s, p) => s + p.value, 0);
  const salesCreatedMonth = projects
    .filter((p) => inRange(p.createdDate, monthStart, now))
    .reduce((s, p) => s + p.value, 0);

  // Invoiced = sum of invoicedAmount (or value as fallback) for projects with invoicedDate in window
  const invoicedWeek = projects
    .filter((p) => inRange(p.invoicedDate, weekStart, now))
    .reduce((s, p) => s + (p.invoicedAmount ?? p.value), 0);
  const invoicedMonth = projects
    .filter((p) => inRange(p.invoicedDate, monthStart, now))
    .reduce((s, p) => s + (p.invoicedAmount ?? p.value), 0);

  const activeProjects = projects.filter((p) => p.status === 'Active' || p.status === 'Bidding');
  const pipeline = projects.filter((p) => p.status !== 'Lost').reduce((s, p) => s + p.value, 0);

  const recentProjects = [...projects]
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
    .slice(0, 6);

  function openProject(id: string) {
    setSelectedProjectId(id);
    navigate('/crm');
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pipeline" value={fmt(pipeline)} icon={DollarSign} hint={`${activeProjects.length} active`} />
        <StatCard label="Customers" value={customers.length} icon={Users} hint="in book" />
        <StatCard label="Products" value={products.length} icon={Package} hint="in catalog" />
        <button
          onClick={() => setShowSettings(true)}
          className="bg-surface rounded-xl border border-divider p-5 flex items-center justify-center gap-2 text-fg-muted hover:text-fg hover:border-divider-strong transition-colors"
        >
          <SettingsIcon size={16} />
          <span className="text-sm font-medium">Edit budget targets</span>
        </button>
      </div>

      {/* Performance cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        <PerformanceCard
          title="Sales Created"
          icon={FileText}
          weekValue={salesCreatedWeek}
          weekTarget={settings.weeklySalesTarget}
          monthValue={salesCreatedMonth}
          monthTarget={settings.monthlySalesTarget}
        />
        <PerformanceCard
          title="Invoiced"
          icon={Receipt}
          weekValue={invoicedWeek}
          weekTarget={settings.weeklyInvoiceTarget}
          monthValue={invoicedMonth}
          monthTarget={settings.monthlyInvoiceTarget}
        />
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
                <button
                  key={proj.id}
                  onClick={() => openProject(proj.id)}
                  className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-surface-1 transition-colors"
                >
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
                </button>
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

      {showSettings && (
        <SettingsModal
          initial={settings}
          onSave={(s) => updateSettings(s)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
