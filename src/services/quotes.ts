import { useAppStore } from '../store/useAppStore';
import type { Quote } from '../types';
import { bidders } from './projects';
import { activities } from './activities';

// Quote service. Owns the quote lifecycle: create → attach to draft → send.
// On send, the customer is auto-added as a bidder on the project (so we can
// learn which subs win with which GCs over time) and an activity is logged.

export const quotes = {
  list(filters?: { projectId?: string; repId?: string }): Quote[] {
    const all = useAppStore.getState().quotes;
    if (!filters) return all;
    return all.filter((q) => {
      if (filters.projectId && q.projectId !== filters.projectId) return false;
      if (filters.repId && q.repId !== filters.repId) return false;
      return true;
    });
  },
  get(id: string): Quote | undefined {
    return useAppStore.getState().quotes.find((q) => q.id === id);
  },
  add(q: Quote): void {
    useAppStore.getState().addQuote(q);
  },
  update(id: string, patch: Partial<Quote>): void {
    useAppStore.getState().updateQuote(id, patch);
  },

  // Mark a quote sent. Auto-add bidder + log activity.
  markSent(id: string): void {
    const q = quotes.get(id);
    if (!q) return;
    const sentDate = new Date().toISOString();
    quotes.update(id, { status: 'sent', sentDate });

    if (q.projectId && q.customerId) {
      bidders.addToProject(q.projectId, {
        id: `bid-${id}`,
        customerId: q.customerId,
        quotedDate: sentDate,
        quotedAmount: q.subtotal,
      });
      activities.log({
        projectId: q.projectId,
        repId: q.repId,
        type: 'quote_sent',
        summary: `Quote sent${q.subtotal ? ` — $${q.subtotal.toFixed(2)}` : ''}`,
        relatedQuoteId: id,
        date: sentDate,
      });
    }
  },
};
