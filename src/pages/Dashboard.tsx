import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import {
  DollarSign, Users, FolderOpen, Package, FileText, Receipt,
  Settings as SettingsIcon, X, Clock, ChevronRight, ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import type { AppSettings, AppointmentChecklist } from '../types';
import { maybeGenerateMondayDigest } from '../lib/dormantDigest';
import LookingAhead from '../components/dashboard/LookingAhead';
import DailyRecap from '../components/dashboard/DailyRecap';
import OpportunitiesInReview from '../components/dashboard/OpportunitiesInReview';

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
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
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

type RecentSortKey = 'updatedDate' | 'createdDate' | 'value' | 'lastTouchAt' | 'anticipatedOrderDate' | 'name';

const RECENT_SORT_LABELS: Record<RecentSortKey, string> = {
  updatedDate:          'Recently updated',
  createdDate:          'Recently created',
  value:                'Largest value',
  lastTouchAt:          'Recently touched',
  anticipatedOrderDate: 'Closing soonest',
  name:                 'Name (A→Z)',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, customers, sampleOrders, products, settings, updateSettings, setSelectedProjectId } = useAppStore();
  const currentRepId = useAppStore((s) => s.currentRepId);
  const dormantDigests = useAppStore((s) => s.dormantDigests);
  const appointments = useAppStore((s) => s.appointments);
  const activities = useAppStore((s) => s.activities);
  const emails = useAppStore((s) => s.emails);
  const drafts = useAppStore((s) => s.drafts);
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const [showSettings, setShowSettings] = useState(false);
  const [recentSort, setRecentSort] = useState<RecentSortKey>('updatedDate');

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const todayKey = now.toISOString().slice(0, 10);

  // Generate this week's dormant digest on Dashboard mount. Idempotent —
  // if a digest already exists for this rep + this week, no-op. The
  // generator drops re-engagement drafts into the drafts folder and a
  // "Weekly Dormant Account Review" email into the inbox.
  useEffect(() => {
    maybeGenerateMondayDigest(currentRepId);
  }, [currentRepId]);

  const currentDigest = useMemo(() => {
    return [...dormantDigests]
      .filter((d) => d.repId === currentRepId)
      .sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0];
  }, [dormantDigests, currentRepId]);

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

  // Filter to the current rep's appointments + activities — Daily Recap and
  // Looking Ahead are personal views, not company-wide aggregates.
  const repAppointments = useMemo(
    () => appointments.filter((a) => a.repId === currentRepId),
    [appointments, currentRepId],
  );
  const repActivities = useMemo(
    () => activities.filter((a) => a.repId === currentRepId),
    [activities, currentRepId],
  );

  // Today's email counts for the recap.
  const emailsTodayCount = useMemo(
    () => emails.filter((e) => e.folder === 'inbox' && e.date.slice(0, 10) === todayKey).length,
    [emails, todayKey],
  );
  const draftsTodayCount = useMemo(
    () => drafts.filter((d) => d.repId === currentRepId && d.createdAt.slice(0, 10) === todayKey).length,
    [drafts, currentRepId, todayKey],
  );

  const recentProjects = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => {
      const av = a[recentSort] ?? '';
      const bv = b[recentSort] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return bv - av;
      // String/date comparisons: descending for date-shaped keys, ascending for name
      const cmp = String(bv).localeCompare(String(av));
      return recentSort === 'name' ? -cmp : cmp;
    });
    return arr.slice(0, 8);
  }, [projects, recentSort]);

  function openProject(id: string) {
    setSelectedProjectId(id);
    navigate('/crm');
  }

  function openSampleOrder(id: string) {
    useAppStore.getState().setSelectedSampleOrderId(id);
    navigate('/samples');
  }

  function handleTogglePacked(id: string, key: keyof AppointmentChecklist, value: AppointmentChecklist[keyof AppointmentChecklist]) {
    const apt = appointments.find((a) => a.id === id);
    if (!apt) return;
    updateAppointment(id, {
      checklist: { ...(apt.checklist ?? {}), [key]: value },
    });
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

      {/* Opportunities in Review — pending candidates from "future opportunity"
          flow on the Samples page. Hides when there are none. */}
      <OpportunitiesInReview
        onJumpToSamples={(sampleOrderId) => {
          useAppStore.getState().setSelectedSampleOrderId(sampleOrderId);
          navigate('/samples');
        }}
      />

      {/* Daily Recap + Looking Ahead — the rep's "what's happening today
          and tomorrow" headline. Stacks on mobile, side-by-side on lg+. */}
      <div className="grid lg:grid-cols-2 gap-4">
        <DailyRecap
          appointments={repAppointments}
          activities={repActivities}
          todayDate={now}
          emailsTodayCount={emailsTodayCount}
          draftsTodayCount={draftsTodayCount}
        />
        <LookingAhead
          appointments={repAppointments}
          todayDate={now}
          onTogglePacked={handleTogglePacked}
        />
      </div>

      {/* Dormant accounts digest — weekly */}
      {currentDigest && currentDigest.entries.length > 0 && (
        <button
          onClick={() => navigate('/email')}
          className="w-full text-left bg-surface rounded-xl border border-warning/30 p-5 flex items-start gap-4 hover:border-warning/50 hover:bg-warning/5 transition-colors group"
        >
          <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/30 text-warning shrink-0">
            <Clock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-fg">
                Dormant accounts — week of {new Date(currentDigest.weekOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </h3>
              <span className="text-xs text-fg-muted">
                {currentDigest.entries.length} account{currentDigest.entries.length === 1 ? '' : 's'}{' '}
                · {currentDigest.entries.filter((e) => e.draftEmailId).length} draft{currentDigest.entries.filter((e) => e.draftEmailId).length === 1 ? '' : 's'} ready
              </span>
            </div>
            <p className="text-xs text-fg-muted mt-1">
              {currentDigest.entries.slice(0, 3).map((e) => e.customerName).join(', ')}
              {currentDigest.entries.length > 3 ? ` + ${currentDigest.entries.length - 3} more` : ''}
              {' — '}90+ days dormant, ranked by past opportunity value.
            </p>
          </div>
          <ChevronRight size={16} className="text-fg-faint group-hover:text-warning shrink-0 mt-1" />
        </button>
      )}

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
          <div className="px-5 py-4 border-b border-divider flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-fg">Recent Projects</h2>
              <p className="text-xs text-fg-muted mt-0.5">{RECENT_SORT_LABELS[recentSort]}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <select
                  className="appearance-none text-xs bg-bg border border-divider rounded-lg pl-2.5 pr-7 py-1.5 text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                  value={recentSort}
                  onChange={(e) => setRecentSort(e.target.value as RecentSortKey)}
                >
                  {(Object.keys(RECENT_SORT_LABELS) as RecentSortKey[]).map((k) => (
                    <option key={k} value={k}>{RECENT_SORT_LABELS[k]}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" />
              </div>
              <FolderOpen size={16} className="text-fg-faint" />
            </div>
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
            {[...sampleOrders]
              .sort((a, b) => b.orderedDate.localeCompare(a.orderedDate))
              .slice(0, 5).map((o) => {
              const customer = customers.find((c) => c.id === o.customerId);
              return (
                <button
                  key={o.id}
                  onClick={() => openSampleOrder(o.id)}
                  className="w-full text-left px-5 py-3.5 hover:bg-surface-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-fg text-sm truncate">{customer?.company ?? '—'}</p>
                    <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0', ORDER_STATUS_PILL[o.status] ?? 'bg-surface-2 text-fg-muted border border-divider')}>
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted mt-1">{o.items.length} item(s) · {o.orderedDate}</p>
                </button>
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
