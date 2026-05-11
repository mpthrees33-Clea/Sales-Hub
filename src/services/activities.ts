import { useAppStore } from '../store/useAppStore';
import type { Activity, ActivityType } from '../types';

// Activity log per opportunity. The CRM AI summary panel (slice 2) and the
// dormancy detector (slice 1) both read from this stream. Anything that
// touches a project should log an activity so the timeline reflects reality.

function newId(): string {
  return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const activities = {
  list(filters?: { projectId?: string; repId?: string }): Activity[] {
    const all = useAppStore.getState().activities;
    if (!filters) return all;
    return all.filter((a) => {
      if (filters.projectId && a.projectId !== filters.projectId) return false;
      if (filters.repId && a.repId !== filters.repId) return false;
      return true;
    });
  },

  log(args: {
    projectId: string;
    repId: string;
    type: ActivityType;
    summary: string;
    body?: string;
    relatedEmailId?: string;
    relatedQuoteId?: string;
    date?: string;
  }): Activity {
    const a: Activity = {
      id: newId(),
      projectId: args.projectId,
      repId: args.repId,
      type: args.type,
      date: args.date ?? new Date().toISOString(),
      summary: args.summary,
      body: args.body,
      relatedEmailId: args.relatedEmailId,
      relatedQuoteId: args.relatedQuoteId,
    };
    useAppStore.getState().addActivity(a);

    // Refresh project's lastTouchAt so dormancy queries don't need to
    // re-derive from the full activity stream every time.
    useAppStore.getState().updateProject(args.projectId, { lastTouchAt: a.date });

    return a;
  },
};
