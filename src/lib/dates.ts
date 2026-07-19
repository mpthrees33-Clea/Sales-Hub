/**
 * Date helpers anchored on the rep's timezone (America/New_York). DB stores
 * UTC; UI renders rep TZ; all "now" reads flow through getDemoNow().
 */
import { TZDate } from "@date-fns/tz";
import {
  addDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { REP } from "@/lib/rep";

export function inRepTz(d: Date): TZDate {
  return new TZDate(d, REP.tz);
}

/** Mon–Sun week containing `d`, computed in rep TZ, returned as UTC instants. */
export function weekBounds(d: Date): { start: Date; end: Date } {
  const z = inRepTz(d);
  return {
    start: new Date(startOfWeek(z, { weekStartsOn: 1 }).getTime()),
    end: new Date(endOfWeek(z, { weekStartsOn: 1 }).getTime()),
  };
}

export function monthBounds(d: Date): { start: Date; end: Date } {
  const z = inRepTz(d);
  return { start: new Date(startOfMonth(z).getTime()), end: new Date(endOfMonth(z).getTime()) };
}

export function dayBounds(d: Date): { start: Date; end: Date } {
  const z = inRepTz(d);
  return { start: new Date(startOfDay(z).getTime()), end: new Date(endOfDay(z).getTime()) };
}

/** "Yesterday" relative to `d` in rep TZ. */
export function yesterdayBounds(d: Date): { start: Date; end: Date } {
  return dayBounds(addDays(inRepTz(d), -1));
}

/** "DEMO • Tue 6:55 AM" top-bar chip format. */
export function formatDemoClock(d: Date): string {
  return format(inRepTz(d), "EEE h:mm a");
}

export function formatTimeShort(d: Date): string {
  return format(inRepTz(d), "h:mm a");
}

export function formatDateShort(d: Date): string {
  return format(inRepTz(d), "MMM d");
}

export function formatDateTime(d: Date): string {
  return format(inRepTz(d), "EEE MMM d, h:mm a");
}

export function formatDateLong(d: Date): string {
  return format(inRepTz(d), "MMMM d, yyyy");
}

/** Demo-clock-relative age string ("4m ago", "3h ago", "2d ago"). */
export function relativeAge(d: Date, now: Date): string {
  const mins = differenceInMinutes(now, d);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** yyyy-MM-dd of `d` in rep TZ (demo-day keys, route cache, briefs). */
export function repDateKey(d: Date): string {
  return format(inRepTz(d), "yyyy-MM-dd");
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
