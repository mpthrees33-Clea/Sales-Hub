import { useAppStore } from '../store/useAppStore';
import type {
  EmailMessage, EmailThread, EmailDraft,
} from '../types';
import { quotes as quotesService } from './quotes';

// Email service. Wraps emails, threads, and auto-generated reply drafts. The
// email AI pipeline lives in src/lib/emailAI.ts; this module owns persistence.

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const emails = {
  list(folder?: EmailMessage['folder']): EmailMessage[] {
    const all = useAppStore.getState().emails;
    if (!folder) return all;
    return all.filter((e) => e.folder === folder);
  },
  inbox(): EmailMessage[] {
    return [...emails.list('inbox')].sort((a, b) => b.date.localeCompare(a.date));
  },
  get(id: string): EmailMessage | undefined {
    return useAppStore.getState().emails.find((e) => e.id === id);
  },
  markRead(id: string): void {
    useAppStore.getState().updateEmail(id, { isRead: true });
  },
  add(e: EmailMessage): void {
    useAppStore.getState().addEmail(e);
  },
  update(id: string, patch: Partial<EmailMessage>): void {
    useAppStore.getState().updateEmail(id, patch);
  },
};

export const threads = {
  list(): EmailThread[] {
    return useAppStore.getState().threads;
  },
  get(id: string): EmailThread | undefined {
    return useAppStore.getState().threads.find((t) => t.id === id);
  },
  // Return existing thread for a subject+participant pair, or create one.
  getOrCreate(args: {
    subject: string;
    participantEmails: string[];
    customerId?: string;
    projectId?: string;
    lastMessageAt: string;
  }): EmailThread {
    const normalizedSubject = args.subject.replace(/^(re:|fwd?:)\s*/i, '').trim().toLowerCase();
    const sortedParticipants = [...args.participantEmails].map((e) => e.toLowerCase()).sort();
    const all = useAppStore.getState().threads;
    const existing = all.find(
      (t) =>
        t.subject.replace(/^(re:|fwd?:)\s*/i, '').trim().toLowerCase() === normalizedSubject &&
        sameSet(t.participantEmails.map((e) => e.toLowerCase()).sort(), sortedParticipants),
    );
    if (existing) return existing;
    const fresh: EmailThread = {
      id: newId('thr'),
      subject: args.subject,
      participantEmails: args.participantEmails,
      customerId: args.customerId,
      projectId: args.projectId,
      lastMessageAt: args.lastMessageAt,
      unreadCount: 0,
    };
    useAppStore.getState().addThread(fresh);
    return fresh;
  },
};

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export const drafts = {
  list(filters?: { repId?: string; status?: EmailDraft['status'] }): EmailDraft[] {
    const all = useAppStore.getState().drafts;
    if (!filters) return all;
    return all.filter((d) => {
      if (filters.repId && d.repId !== filters.repId) return false;
      if (filters.status && d.status !== filters.status) return false;
      return true;
    });
  },
  get(id: string): EmailDraft | undefined {
    return useAppStore.getState().drafts.find((d) => d.id === id);
  },
  // Return any existing draft for a given received email. Idempotent so the
  // auto-draft pipeline doesn't double-generate when the inbox refreshes.
  getForEmail(receivedEmailId: string): EmailDraft | undefined {
    return useAppStore.getState().drafts.find((d) => d.inReplyToEmailId === receivedEmailId);
  },
  add(d: EmailDraft): void {
    useAppStore.getState().addDraft(d);
  },
  update(id: string, patch: Partial<EmailDraft>): void {
    useAppStore.getState().updateDraft(id, patch);
  },
  discard(id: string): void {
    useAppStore.getState().updateDraft(id, { status: 'discarded' });
  },

  // Materialize a draft as a real outgoing email and mark it sent. In demo
  // mode this just moves the draft into the sent folder as an EmailMessage;
  // when the Gmail API integration lands, this is where the send call goes.
  //
  // Side effects on send:
  //   1. EmailMessage appears in sent folder
  //   2. Draft marked sent
  //   3. If the draft has an attached Quote, that Quote is marked sent —
  //      which auto-adds the recipient customer as a Bidder on the project
  //      and logs a quote_sent Activity (see services/quotes.ts).
  send(id: string): EmailMessage | undefined {
    const draft = drafts.get(id);
    if (!draft) return undefined;
    const inReplyTo = useAppStore.getState().emails.find((e) => e.id === draft.inReplyToEmailId);
    const currentRep = useAppStore.getState().reps.find(
      (r) => r.id === draft.repId,
    );
    const sent: EmailMessage = {
      id: newId('em'),
      folder: 'sent',
      isRead: true,
      isStarred: false,
      from: currentRep?.email ?? 'colton@trinitysurfaces.com',
      fromName: currentRep?.name ?? 'Colton P.',
      to: inReplyTo ? [inReplyTo.from] : [],
      subject: draft.subject,
      body: draft.body,
      date: new Date().toISOString(),
      attachedBrochureIds: draft.attachedBrochureIds,
    };
    emails.add(sent);
    drafts.update(id, { status: 'sent', sentAt: sent.date });

    // Bidder + activity auto-add for sent quotes.
    if (draft.quoteId) {
      quotesService.markSent(draft.quoteId);
    }
    return sent;
  },
};
