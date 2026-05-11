import { useAppStore } from '../store/useAppStore';
import type {
  DormantAccountEntry, DormantDigest, Customer, CustomerType,
} from '../types';

// Dormant accounts service. Computes "who has gone quiet on us" weekly so the
// rep gets a Monday digest with drafted re-engagement emails. Slice 1 ships
// the data + UI; the LLM call to draft each re-engagement email lives in
// src/lib/emailAI.ts.

const DORMANCY_THRESHOLD_DAYS = 90;
const DIGEST_SIZE = 10;

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

// Find the most recent Monday on or before `now`. Used as the digest's
// `weekOf` key so we can detect "did we already generate this week's digest".
export function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;  // Sun → 6 back, Mon → 0 back
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function templateTypeFor(type: CustomerType): DormantAccountEntry['templateType'] {
  switch (type) {
    case 'Architect':
    case 'Designer':
      return 'lunch_and_learn';
    case 'Contractor':
      return 'check_in';
    case 'Dealer':
      return 'new_opportunity';
    case 'Homeowner':
      return 'check_in';
    default:
      return 'check_in';
  }
}

export const dormant = {
  // Compute this week's digest data. Pure — doesn't write to the store.
  // Returns the top N customers whose most recent opportunity touch is
  // older than DORMANCY_THRESHOLD_DAYS, ranked by past opportunity value.
  computeThisWeek(repId: string, now: Date = new Date()): DormantAccountEntry[] {
    const state = useAppStore.getState();
    const repProjects = state.projects.filter((p) => p.salesRepId === repId);

    // Group by customer (project's primary customerId)
    const byCustomer = new Map<string, { customer: Customer; lastTouch: string; totalValue: number }>();
    for (const p of repProjects) {
      const customer = state.customers.find((c) => c.id === p.customerId);
      if (!customer) continue;
      const lastTouch = p.lastTouchAt ?? `${p.updatedDate ?? p.createdDate}T12:00:00Z`;
      const entry = byCustomer.get(customer.id);
      if (!entry) {
        byCustomer.set(customer.id, { customer, lastTouch, totalValue: p.value });
      } else {
        if (lastTouch > entry.lastTouch) entry.lastTouch = lastTouch;
        entry.totalValue += p.value;
      }
    }

    const dormantEntries: DormantAccountEntry[] = [];
    const nowIso = now.toISOString();
    for (const { customer, lastTouch, totalValue } of byCustomer.values()) {
      const days = daysBetween(lastTouch, nowIso);
      if (days >= DORMANCY_THRESHOLD_DAYS) {
        dormantEntries.push({
          customerId: customer.id,
          customerName: customer.company,
          customerType: customer.type,
          lastTouchAt: lastTouch,
          daysDormant: days,
          pastOpportunityValue: totalValue,
          templateType: templateTypeFor(customer.type),
        });
      }
    }

    return dormantEntries
      .sort((a, b) => b.pastOpportunityValue - a.pastOpportunityValue)
      .slice(0, DIGEST_SIZE);
  },

  // Look up an existing digest for the rep + week, if any.
  getThisWeek(repId: string, now: Date = new Date()): DormantDigest | undefined {
    const week = mondayOf(now);
    return useAppStore.getState().dormantDigests.find(
      (d) => d.repId === repId && d.weekOf === week,
    );
  },

  // Persist a generated digest. Called by the email AI pipeline after it has
  // drafted re-engagement emails for each entry.
  save(digest: DormantDigest): void {
    useAppStore.getState().addDormantDigest(digest);
  },
};
