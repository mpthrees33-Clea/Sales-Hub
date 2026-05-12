import { useMemo } from 'react';
import {
  Sun, CheckCircle2, Mail, Receipt, Phone, MapPin, Coffee,
  Sparkles, Users, Briefcase,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type { Appointment, AppointmentType, Activity, ActivityType } from '../../types';

// Daily Recap — yesterday + today summary so the rep can open the dashboard
// and immediately know "what did I do, what happened, what's still on the
// books for the rest of today." Reads from activities + appointments.

const APT_ICON: Record<AppointmentType, React.ElementType> = {
  lunch_and_learn:    Coffee,
  presentation:       Sparkles,
  meeting:            Users,
  site_visit:         MapPin,
  call:               Phone,
  lunch:              Coffee,
  sample_walkthrough: Briefcase,
  travel:             MapPin,
  other:              CheckCircle2,
};

const ACTIVITY_ICON: Record<ActivityType, React.ElementType> = {
  email_in:      Mail,
  email_out:     Mail,
  call:          Phone,
  meeting:       Users,
  note:          CheckCircle2,
  status_change: CheckCircle2,
  stage_change:  CheckCircle2,
  quote_sent:    Receipt,
  sample_sent:   Briefcase,
  site_visit:    MapPin,
};

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

function dateKey(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

function yesterdayKey(d: Date): string {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return y.toISOString().slice(0, 10);
}

function isSameDay(iso: string, target: string): boolean {
  return iso.slice(0, 10) === target;
}

interface Props {
  appointments: Appointment[];
  activities: Activity[];
  todayDate: Date;
  emailsTodayCount: number;
  draftsTodayCount: number;
}

export default function DailyRecap({
  appointments, activities, todayDate, emailsTodayCount, draftsTodayCount,
}: Props) {
  const today = dateKey(todayDate);
  const yesterday = yesterdayKey(todayDate);
  const nowHHMM = `${String(todayDate.getHours()).padStart(2, '0')}:${String(todayDate.getMinutes()).padStart(2, '0')}`;

  const completedToday = useMemo(
    () => appointments.filter((a) => a.date === today && a.status === 'completed').sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, today],
  );

  const upcomingToday = useMemo(
    () => appointments.filter((a) => a.date === today && a.status !== 'completed' && a.status !== 'cancelled' && a.startTime >= nowHHMM).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, today, nowHHMM],
  );

  const completedYesterday = useMemo(
    () => appointments.filter((a) => a.date === yesterday && a.status === 'completed').sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, yesterday],
  );

  const todayActivities = useMemo(
    () => activities.filter((a) => isSameDay(a.date, today)).sort((a, b) => b.date.localeCompare(a.date)),
    [activities, today],
  );

  // Aggregate counts for the headline strip
  const counts = useMemo(() => {
    const out = { emails_out: 0, quotes_sent: 0, calls: 0, meetings: 0, notes: 0 };
    for (const a of todayActivities) {
      if (a.type === 'email_out') out.emails_out += 1;
      else if (a.type === 'quote_sent') out.quotes_sent += 1;
      else if (a.type === 'call') out.calls += 1;
      else if (a.type === 'meeting') out.meetings += 1;
      else if (a.type === 'note') out.notes += 1;
    }
    return out;
  }, [todayActivities]);

  const todayLabel = todayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="bg-surface rounded-xl border border-divider overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <Sun size={16} className="text-warning" />
          <h2 className="text-sm font-semibold text-fg">Daily Recap</h2>
        </div>
        <p className="text-xs text-fg-muted">{todayLabel}</p>
      </div>

      {/* Headline counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-5 py-3 border-b border-divider">
        <StatPill icon={CheckCircle2} label="Done today"      value={completedToday.length} accent />
        <StatPill icon={Mail}         label="Emails received" value={emailsTodayCount} />
        <StatPill icon={Sparkles}     label="AI drafts"       value={draftsTodayCount} />
        <StatPill icon={Receipt}      label="Quotes sent"     value={counts.quotes_sent} />
      </div>

      <div className="px-5 py-3 space-y-3">
        {/* Yesterday */}
        {completedYesterday.length > 0 && (
          <Section title={`Yesterday (${completedYesterday.length})`}>
            {completedYesterday.map((a) => <CompletedRow key={a.id} appointment={a} />)}
          </Section>
        )}

        {/* Today — completed so far */}
        {completedToday.length > 0 && (
          <Section title={`Today so far (${completedToday.length})`}>
            {completedToday.map((a) => <CompletedRow key={a.id} appointment={a} />)}
          </Section>
        )}

        {/* Today — still ahead */}
        {upcomingToday.length > 0 && (
          <Section title={`Still ahead today (${upcomingToday.length})`}>
            {upcomingToday.map((a) => <UpcomingRow key={a.id} appointment={a} />)}
          </Section>
        )}

        {completedYesterday.length === 0 && completedToday.length === 0 && upcomingToday.length === 0 && (
          <p className="text-sm text-fg-faint italic">No appointments logged today or yesterday.</p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-fg-muted uppercase tracking-widest mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatPill({
  icon: Icon, label, value, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={clsx(
      'rounded-lg border px-3 py-2 flex items-center gap-2',
      accent ? 'bg-accent/10 border-accent/30' : 'bg-bg/40 border-divider',
    )}>
      <Icon size={14} className={accent ? 'text-accent-light' : 'text-fg-muted'} />
      <div className="min-w-0">
        <p className={clsx('text-lg font-semibold tabular-nums leading-none', accent ? 'text-fg' : 'text-fg')}>{value}</p>
        <p className="text-xs text-fg-faint">{label}</p>
      </div>
    </div>
  );
}

function CompletedRow({ appointment: a }: { appointment: Appointment }) {
  const customers = useAppStore((s) => s.customers);
  const customer = a.customerId ? customers.find((c) => c.id === a.customerId) : undefined;
  const Icon = APT_ICON[a.type] ?? CheckCircle2;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-fg-faint tabular-nums w-12 shrink-0">{fmtTime(a.startTime)}</span>
      <CheckCircle2 size={11} className="text-success shrink-0 mt-0.5" />
      <Icon size={11} className="text-fg-muted shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-fg leading-snug truncate">{a.title}</p>
        {customer && <p className="text-fg-faint truncate">{customer.company}</p>}
      </div>
    </div>
  );
}

function UpcomingRow({ appointment: a }: { appointment: Appointment }) {
  const customers = useAppStore((s) => s.customers);
  const customer = a.customerId ? customers.find((c) => c.id === a.customerId) : undefined;
  const Icon = APT_ICON[a.type] ?? CheckCircle2;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-fg tabular-nums w-12 shrink-0 font-medium">{fmtTime(a.startTime)}</span>
      <Icon size={11} className="text-accent-light shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-fg leading-snug truncate">{a.title}</p>
        {customer && <p className="text-fg-faint truncate">{customer.company}</p>}
      </div>
    </div>
  );
}
