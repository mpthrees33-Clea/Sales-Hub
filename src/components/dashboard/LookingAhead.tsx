import { useMemo } from 'react';
import {
  Calendar, CalendarClock, Coffee, Briefcase, MapPin, Phone, Users,
  Sparkles, Truck, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type { Appointment, AppointmentType, AppointmentChecklist, FoodOrderStatus } from '../../types';

// Looking Ahead — next 7 days of appointments, expanded for tomorrow and
// collapsed-but-clickable for the rest. Per-appointment action items
// (food not ordered, samples not shipped, route not checked) surface as
// chips so the rep can spot what needs doing at a glance.

const TYPE_META: Record<AppointmentType, { icon: React.ElementType; label: string; colorClass: string }> = {
  lunch_and_learn:    { icon: Coffee,    label: 'Lunch & Learn',     colorClass: 'text-warning bg-warning/15 border-warning/30' },
  presentation:       { icon: Sparkles,  label: 'Presentation',      colorClass: 'text-accent-light bg-accent/15 border-accent/30' },
  meeting:            { icon: Users,     label: 'Meeting',           colorClass: 'text-fg bg-surface-1 border-divider' },
  site_visit:         { icon: MapPin,    label: 'Site visit',        colorClass: 'text-success bg-success/15 border-success/30' },
  call:               { icon: Phone,     label: 'Call',              colorClass: 'text-fg-muted bg-surface-1 border-divider' },
  lunch:              { icon: Coffee,    label: 'Lunch',             colorClass: 'text-warning bg-warning/10 border-warning/20' },
  sample_walkthrough: { icon: Briefcase, label: 'Sample walkthrough', colorClass: 'text-accent-light bg-accent/15 border-accent/30' },
  travel:             { icon: Truck,     label: 'Travel',            colorClass: 'text-fg-muted bg-surface-1 border-divider' },
  other:              { icon: Calendar,  label: 'Other',             colorClass: 'text-fg-muted bg-surface-1 border-divider' },
};

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h${rem}m`;
}

function dayLabel(date: string, today: Date): string {
  const d = new Date(date + 'T12:00:00');
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - todayMid.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Surface every action item the rep needs to handle on this appointment.
// Sorted by urgency — food order > samples > route > confirmation > brochures.
interface ActionItem {
  level: 'urgent' | 'todo' | 'ok';
  label: string;
  icon: React.ElementType;
}

function actionItems(a: Appointment): ActionItem[] {
  const items: ActionItem[] = [];
  const c: AppointmentChecklist = a.checklist ?? {};

  if (a.type === 'lunch_and_learn' || a.type === 'lunch') {
    if (c.foodOrdered === 'pending' || c.foodOrdered === undefined) {
      items.push({ level: 'urgent', label: 'Order food', icon: AlertCircle });
    } else if (c.foodOrdered === 'ordered' || c.foodOrdered === 'delivered') {
      items.push({ level: 'ok', label: c.foodOrdered === 'delivered' ? 'Food confirmed' : 'Food ordered', icon: CheckCircle2 });
    }
  }

  if (a.type === 'site_visit' || a.type === 'presentation' || a.type === 'sample_walkthrough' || a.type === 'meeting') {
    if (c.samplesShipped === false) {
      items.push({ level: 'urgent', label: 'Ship samples', icon: AlertCircle });
    } else if (c.samplesShipped === true) {
      items.push({ level: 'ok', label: 'Samples shipped', icon: CheckCircle2 });
    }
  }

  if (a.type === 'presentation' && c.presentationDeckReady === false) {
    items.push({ level: 'urgent', label: 'Prep deck', icon: AlertCircle });
  }

  if (c.routeChecked === false) {
    items.push({ level: 'todo', label: 'Check route', icon: Clock });
  }

  if (c.confirmedWithCustomer === false) {
    items.push({ level: 'todo', label: 'Confirm w/ customer', icon: Clock });
  }

  return items;
}

function levelClass(level: ActionItem['level']): string {
  switch (level) {
    case 'urgent': return 'bg-danger/15 text-danger border-danger/30';
    case 'todo':   return 'bg-warning/10 text-warning border-warning/30';
    case 'ok':     return 'bg-success/10 text-success border-success/30';
  }
}

// Long-drive heuristic — if the appointment is in a different city/region
// from the rep's primary location (Atlanta), flag it as a route warning.
const REP_HOME_HINTS = ['atlanta', 'sandy springs', 'marietta', 'decatur', 'roswell', 'smyrna', 'buckhead'];
function isLongDrive(a: Appointment): boolean {
  if (!a.address) return false;
  const addr = a.address.toLowerCase();
  if (REP_HOME_HINTS.some((c) => addr.includes(c))) return false;
  // Macon, Augusta, Savannah, Calhoun, Highlands, Tybee are far drives.
  return /\b(macon|augusta|savannah|tybee|calhoun|highlands|columbus|valdosta|gainesville)\b/i.test(addr);
}

interface Props {
  appointments: Appointment[];
  todayDate: Date;
  onOpenAppointment?: (id: string) => void;
  onTogglePacked?: (id: string, key: keyof AppointmentChecklist, value: any) => void;
}

export default function LookingAhead({ appointments, todayDate, onTogglePacked }: Props) {
  // Group by date, only show today onward, limit to next ~7 days
  const grouped = useMemo(() => {
    const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 8);

    const buckets = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const d = new Date(a.date + 'T12:00:00');
      if (d < today || d >= cutoff) continue;
      if (a.status === 'cancelled') continue;
      if (!buckets.has(a.date)) buckets.set(a.date, []);
      buckets.get(a.date)!.push(a);
    }
    // Sort each bucket by time
    for (const list of buckets.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    // Return as array sorted by date (tuple [date, list])
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [appointments, todayDate]);

  const todayKey = todayDate.toISOString().slice(0, 10);

  if (grouped.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-divider p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={16} className="text-accent-light" />
          <h2 className="text-sm font-semibold text-fg">Looking Ahead</h2>
        </div>
        <p className="text-sm text-fg-faint italic">No appointments on the books for the next week.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-divider overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-accent-light" />
          <h2 className="text-sm font-semibold text-fg">Looking Ahead</h2>
        </div>
        <p className="text-xs text-fg-muted">Next 7 days · {appointments.filter((a) => a.date >= todayKey && a.status !== 'cancelled').length} appointments</p>
      </div>

      <div className="divide-y divide-divider">
        {grouped.map(([date, list], dayIdx) => (
          <DaySection
            key={date}
            date={date}
            label={dayLabel(date, todayDate)}
            appointments={list}
            expanded={dayIdx <= 1}    // Today + Tomorrow expanded by default
            onTogglePacked={onTogglePacked}
          />
        ))}
      </div>
    </div>
  );
}

function DaySection({
  date, label, appointments, expanded: initialExpanded, onTogglePacked,
}: {
  date: string;
  label: string;
  appointments: Appointment[];
  expanded: boolean;
  onTogglePacked?: (id: string, key: keyof AppointmentChecklist, value: any) => void;
}) {
  // Compute aggregate stats for the day
  const allActionItems = appointments.flatMap((a) => actionItems(a));
  const urgent = allActionItems.filter((i) => i.level === 'urgent').length;
  const todoCount = allActionItems.filter((i) => i.level === 'todo').length;

  return (
    <details open={initialExpanded} className="group">
      <summary className={clsx(
        'px-5 py-3 cursor-pointer flex items-center gap-3 list-none hover:bg-bg/40 transition-colors',
        '[&::-webkit-details-marker]:hidden',
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Calendar size={14} className="text-fg-faint shrink-0 group-open:hidden" />
          <CalendarClock size={14} className="text-accent-light shrink-0 hidden group-open:block" />
          <span className="text-sm font-semibold text-fg">{label}</span>
          <span className="text-xs text-fg-faint">{date}</span>
          <span className="text-xs text-fg-muted">· {appointments.length} appointment{appointments.length === 1 ? '' : 's'}</span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {urgent > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-danger/15 text-danger border-danger/30">
              {urgent} urgent
            </span>
          )}
          {todoCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-warning/10 text-warning border-warning/30">
              {todoCount} todo
            </span>
          )}
        </div>
      </summary>
      <div className="px-5 pb-3 space-y-2">
        {appointments.map((a) => (
          <AppointmentCard key={a.id} appointment={a} onTogglePacked={onTogglePacked} />
        ))}
      </div>
    </details>
  );
}

function AppointmentCard({
  appointment: a,
  onTogglePacked,
}: {
  appointment: Appointment;
  onTogglePacked?: (id: string, key: keyof AppointmentChecklist, value: any) => void;
}) {
  const customers = useAppStore((s) => s.customers);
  const projects = useAppStore((s) => s.projects);
  const customer = a.customerId ? customers.find((c) => c.id === a.customerId) : undefined;
  const project = a.projectId ? projects.find((p) => p.id === a.projectId) : undefined;
  const items = actionItems(a);
  const longDrive = isLongDrive(a);
  const meta = TYPE_META[a.type];
  const Icon = meta.icon;

  return (
    <div className={clsx(
      'rounded-lg border p-3 bg-bg/40',
      items.some((i) => i.level === 'urgent') ? 'border-danger/30' : 'border-divider',
    )}>
      <div className="flex gap-3 items-start">
        {/* Time + type */}
        <div className="shrink-0 text-center">
          <p className="text-sm font-semibold text-fg tabular-nums">{fmtTime(a.startTime)}</p>
          <p className="text-xs text-fg-faint">{fmtDuration(a.durationMin)}</p>
          <div className={clsx('mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border', meta.colorClass)}>
            <Icon size={10} />
            <span className="text-[10px] uppercase tracking-wider font-medium">{meta.label}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg leading-snug">{a.title}</p>
          <p className="text-xs text-fg-muted mt-0.5">
            {customer?.company ?? '—'}
            {project && <> · <span className="italic">{project.name}</span></>}
            {a.attendeeCount && <> · {a.attendeeCount} attendees</>}
          </p>
          {a.address && (
            <p className="text-xs text-fg-faint mt-1 flex items-center gap-1">
              <MapPin size={10} /> {a.address}
              {longDrive && (
                <span className="ml-2 text-warning text-xs italic">long drive</span>
              )}
            </p>
          )}

          {/* Action item chips */}
          {(items.length > 0 || longDrive) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {items.map((it, i) => {
                const ItIcon = it.icon;
                // Special-case: lunch & learn food order has a one-click toggle
                const isFoodOrder = it.label === 'Order food' && (a.type === 'lunch_and_learn' || a.type === 'lunch');
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!onTogglePacked || (!isFoodOrder && it.level !== 'urgent' && it.level !== 'todo')}
                    onClick={() => {
                      if (!onTogglePacked) return;
                      // Map chip → checklist field. Right now only "Order food" mutates state.
                      if (isFoodOrder) {
                        onTogglePacked(a.id, 'foodOrdered', 'ordered' as FoodOrderStatus);
                      } else if (it.label === 'Ship samples') {
                        onTogglePacked(a.id, 'samplesShipped', true);
                      } else if (it.label === 'Check route') {
                        onTogglePacked(a.id, 'routeChecked', true);
                      } else if (it.label === 'Confirm w/ customer') {
                        onTogglePacked(a.id, 'confirmedWithCustomer', true);
                      } else if (it.label === 'Prep deck') {
                        onTogglePacked(a.id, 'presentationDeckReady', true);
                      }
                    }}
                    className={clsx(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border transition-all',
                      levelClass(it.level),
                      (it.level === 'urgent' || it.level === 'todo') && onTogglePacked
                        ? 'hover:scale-105 cursor-pointer'
                        : 'cursor-default',
                    )}
                    title={it.level === 'urgent' || it.level === 'todo' ? 'Click to mark done' : ''}
                  >
                    <ItIcon size={10} /> {it.label}
                  </button>
                );
              })}
              {longDrive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border bg-warning/10 text-warning border-warning/30">
                  <Truck size={10} /> long drive — confirm departure
                </span>
              )}
            </div>
          )}

          {a.notes && (
            <p className="text-xs text-fg-faint mt-2 italic leading-relaxed">{a.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
