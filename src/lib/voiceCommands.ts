import { useAppStore } from '../store/useAppStore';
import { drafts as draftsService } from '../services/email';
import { regenerateDraft } from './autoDraft';
import type {
  Project, ProjectExtensions, OpportunityStage, OpportunityStatus,
} from '../types';

type ExtendedProject = Project & ProjectExtensions;

// Page-aware voice command router. Sits in front of the default assistant —
// when the rep is on a page that has its own command vocabulary (today:
// /email), patterns matching that vocabulary handle the request directly.
// Anything that doesn't match falls through to the regular assistant engine.
//
// All commands return a string (spoken back via TTS) on success, or null when
// the input wasn't a recognized command for this page.

export interface VoiceContext {
  pathname: string;
}

export async function tryPageVoiceCommand(
  text: string,
  ctx: VoiceContext,
): Promise<string | null> {
  const t = text.trim();
  if (!t) return null;
  // Email commands fire only on /email (they target the currently-open email).
  if (ctx.pathname === '/email') {
    const r = await tryEmailCommand(t);
    if (r !== null) return r;
  }
  // Scheduling commands work from any page — checked before CRM so phrases
  // like "what's tomorrow look like" don't false-positive on project names.
  const scheduleResp = trySchedulingCommand(t);
  if (scheduleResp !== null) return scheduleResp;
  // CRM commands work from any page — the rep can update a project while
  // driving regardless of which screen is up.
  return tryCrmCommand(t);
}

// ── /email commands ─────────────────────────────────────────
async function tryEmailCommand(text: string): Promise<string | null> {
  const state = useAppStore.getState();
  const emailId = state.selectedEmailId;
  const draft = emailId
    ? state.drafts.find((d) => d.inReplyToEmailId === emailId && d.status !== 'discarded')
    : undefined;

  // ── send ──
  if (/^\s*(?:send|send (?:it|that|this|the (?:email|draft|reply)))[\s.!]*$/i.test(text)) {
    if (!emailId) return "Open an email first, then tell me to send.";
    if (!draft) return "There's no draft to send yet. Tap 'Generate AI reply draft' first.";
    if (draft.status === 'pending') return "The draft still needs a project link — handle that prompt first.";
    if (draft.status === 'sent') return "That draft has already been sent.";
    const sent = draftsService.send(draft.id);
    return sent ? "Sent." : "Couldn't send the draft.";
  }

  // ── regenerate ──
  if (/^\s*(?:regenerate|redraft|rewrite|redo)\s*(?:the\s+(?:reply|draft|email))?[\s.!]*$/i.test(text)) {
    if (!emailId) return "Open an email first.";
    await regenerateDraft(emailId);
    return "Regenerated the draft.";
  }

  // ── discard ──
  if (/^\s*(?:discard|throw out|delete|trash)\s*(?:the\s+)?(?:reply|draft)?[\s.!]*$/i.test(text)) {
    if (!draft) return "No draft to discard.";
    draftsService.discard(draft.id);
    return "Discarded.";
  }

  // ── edit reply to say X ──
  // Captures everything after "say": rep is dictating the new reply body.
  const editMatch = text.match(/^(?:edit|change|rewrite|update)\s+(?:the\s+)?(?:reply|draft|email)\s+to\s+say\s+(.+)$/i);
  if (editMatch) {
    if (!draft) return "Generate a draft first, then tell me how to edit it.";
    const newBody = wrapAsReplyBody(editMatch[1].trim());
    draftsService.update(draft.id, { body: newBody, isEdited: true });
    return "Updated the draft body.";
  }

  // ── attach X spec sheet / brochure ──
  const attachMatch = text.match(/^(?:attach|add)\s+(?:the\s+)?(.+?)\s+(?:spec\s+sheet|brochure|literature|catalog|brochures)\s*$/i);
  if (attachMatch) {
    if (!draft) return "Generate a draft first, then I can attach brochures.";
    const query = attachMatch[1].trim().toLowerCase();
    const brochure = state.brochures.find((b) =>
      b.name.toLowerCase().includes(query) ||
      b.brand.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query) ||
      b.tags.some((t) => t.toLowerCase().includes(query)),
    );
    if (!brochure) return `Couldn't find a brochure matching "${query}".`;
    if (draft.attachedBrochureIds.includes(brochure.id)) return `${brochure.name} is already attached.`;
    draftsService.update(draft.id, {
      attachedBrochureIds: [...draft.attachedBrochureIds, brochure.id],
    });
    return `Attached ${brochure.name}.`;
  }

  // ── remove [X] attachment ──
  const removeMatch = text.match(/^(?:remove|drop)\s+(?:the\s+)?(.+?)\s+(?:attachment|brochure|spec\s+sheet)\s*$/i);
  if (removeMatch) {
    if (!draft || !draft.attachedBrochureIds.length) return "Nothing to remove.";
    const query = removeMatch[1].trim().toLowerCase();
    const bid = draft.attachedBrochureIds.find((id) => {
      const b = state.brochures.find((br) => br.id === id);
      return b && (b.name.toLowerCase().includes(query) || b.brand.toLowerCase().includes(query));
    });
    if (!bid) return `No attachment matches "${query}".`;
    const removed = state.brochures.find((b) => b.id === bid)?.name ?? 'attachment';
    draftsService.update(draft.id, {
      attachedBrochureIds: draft.attachedBrochureIds.filter((id) => id !== bid),
    });
    return `Removed ${removed}.`;
  }

  // ── read me this email / read the email ──
  if (/^\s*(?:read|read me|read out)\s+(?:this\s+|the\s+)?(?:email|message)[\s.!]*$/i.test(text)) {
    if (!emailId) return "Open an email first.";
    const email = state.emails.find((e) => e.id === emailId);
    if (!email) return "Couldn't find the email.";
    return `From ${email.fromName}. Subject: ${email.subject}. ${email.body}`;
  }

  return null;
}

// ── CRM commands ─────────────────────────────────────────────
// Project mutation commands. Work from any page since reps often think
// about a specific project regardless of what screen they're on.
//
//   "update [project] next step to [text]"
//   "set [project] next step [text]"
//   "mark [project] as bidding / won / lost / active / on hold / awarded / ..."
//   "set [project] value to [amount]"
//   "set [project] stage to [stage]"
//   "add note to [project] [text]"  (with or without colon)
//   "what's the status on [project]" / "where is [project]" / "summarize [project]"
//   "open [project]" / "show me [project]"
async function tryCrmCommand(text: string): Promise<string | null> {
  // ── next step ──
  const nextStepMatch = text.match(/^(?:update|set)\s+(.+?)(?:'s)?\s+next\s+step\s+(?:to|is|=|:)\s*(.+)$/i);
  if (nextStepMatch) {
    return applyProjectMutation(nextStepMatch[1], (p) => ({
      patch: { nextStep: nextStepMatch[2].trim() },
      message: `Updated next step on ${p.name}.`,
    }));
  }

  // ── mark as <status|stage> ──
  const markMatch = text.match(/^mark\s+(.+?)\s+as\s+(.+?)[\s.!]*$/i);
  if (markMatch) {
    const target = markMatch[2].trim().toLowerCase();
    return applyProjectMutation(markMatch[1], (p) => {
      const mapped = mapStatusOrStage(target);
      if (!mapped) return { patch: {}, message: `Don't know "${target}" — try active, on hold, bidding, design, won, or lost.` };
      return {
        patch: mapped.patch,
        message: `Marked ${p.name} as ${mapped.label}.`,
      };
    });
  }

  // ── set <project> stage to <stage> ──
  const stageMatch = text.match(/^(?:set|move)\s+(.+?)(?:'s)?\s+(?:stage|to)\s+(?:to|=)?\s*(.+?)\s*$/i);
  if (stageMatch) {
    const target = stageMatch[2].trim().toLowerCase();
    const stage = mapStage(target);
    if (stage) {
      return applyProjectMutation(stageMatch[1], (p) => ({
        patch: { opportunityStage: stage },
        message: `Moved ${p.name} to ${stage.replace(/_/g, ' ')}.`,
      }));
    }
  }

  // ── set value ──
  const valueMatch = text.match(/^(?:update|set)\s+(.+?)(?:'s)?\s+(?:value|amount|estimate)\s+(?:to|=|is)\s*\$?\s*([\d,.]+\s*k?)\s*$/i);
  if (valueMatch) {
    const amount = parseAmount(valueMatch[2]);
    if (!amount) return `Couldn't parse the dollar amount "${valueMatch[2]}".`;
    return applyProjectMutation(valueMatch[1], (p) => ({
      patch: { value: amount },
      message: `Set ${p.name} value to $${amount.toLocaleString()}.`,
    }));
  }

  // ── add note ──
  const noteMatch = text.match(/^add\s+(?:a\s+)?note\s+(?:to|on)\s+(.+?)\s*[:;]\s*(.+)$/i)
    ?? text.match(/^add\s+(?:a\s+)?note\s+(?:to|on)\s+(.+?)\s+(.+)$/i);
  if (noteMatch) {
    return applyProjectMutation(noteMatch[1], (p) => {
      const state = useAppStore.getState();
      const me = state.reps.find((r) => r.isCurrentUser) ?? state.reps[0];
      const note = {
        id: `n-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        text: noteMatch[2].trim(),
        author: me?.name ?? 'You',
      };
      return {
        patch: { notes: [...p.notes, note] },
        message: `Added a note to ${p.name}.`,
      };
    });
  }

  // ── status query ──
  const statusMatch = text.match(/^(?:what(?:'s| is)?\s+(?:the\s+)?status\s+(?:on|of)|where(?:'s| is)?|how(?:'s| is)?)\s+(.+?)\??[\s.!]*$/i);
  if (statusMatch) {
    const project = findProjectByQuery(statusMatch[1]);
    if (!project) return `Couldn't find a project matching "${statusMatch[1]}".`;
    return describeProject(project);
  }

  // ── open in CRM ──
  const openMatch = text.match(/^(?:open|show(?:\s+me)?|jump to|go to)\s+(.+?)[\s.!]*$/i);
  if (openMatch) {
    const project = findProjectByQuery(openMatch[1]);
    if (!project) return `Couldn't find a project matching "${openMatch[1]}".`;
    useAppStore.getState().setSelectedProjectId(project.id);
    return `Opening ${project.name} in CRM.`;
  }

  return null;
}

interface MutationResult {
  patch: Partial<ExtendedProject>;
  message: string;
}

// Apply a project mutation by fuzzy-resolving the project name. Centralized
// so every command gets consistent ambiguity / not-found responses.
function applyProjectMutation(
  projectQuery: string,
  fn: (p: ExtendedProject) => MutationResult,
): string {
  const project = findProjectByQuery(projectQuery);
  if (!project) return `Couldn't find a project matching "${projectQuery}".`;
  const { patch, message } = fn(project);
  if (Object.keys(patch).length === 0) return message;
  useAppStore.getState().updateProject(project.id, patch);
  return message;
}

// Fuzzy project lookup. Tries exact name → substring → all-words-present.
// On ambiguity, returns the most recently touched project so the rep gets
// the one they were most likely thinking of.
function findProjectByQuery(query: string): ExtendedProject | undefined {
  const state = useAppStore.getState();
  const q = query.toLowerCase().trim();
  if (!q) return undefined;

  const myProjects = state.projects.filter((p) => p.salesRepId === state.currentRepId);
  // Search the rep's projects first; fall back to all if no match.
  const pools = [myProjects, state.projects];

  for (const pool of pools) {
    const exact = pool.find((p) => p.name.toLowerCase() === q);
    if (exact) return exact;

    const subs = pool.filter((p) => p.name.toLowerCase().includes(q));
    if (subs.length === 1) return subs[0];
    if (subs.length > 1) {
      return [...subs].sort((a, b) =>
        (b.lastTouchAt ?? b.updatedDate ?? '').localeCompare(a.lastTouchAt ?? a.updatedDate ?? ''),
      )[0];
    }

    const words = q.split(/\s+/);
    const wordMatch = pool.find((p) => {
      const pName = p.name.toLowerCase();
      return words.every((w) => pName.includes(w));
    });
    if (wordMatch) return wordMatch;
  }

  return undefined;
}

// "$185k" / "185k" / "185,000" / "1.2M" → number
function parseAmount(text: string): number {
  const cleaned = text.replace(/[$,\s]/g, '').toLowerCase();
  if (!cleaned) return 0;
  const m = cleaned.match(/^([\d.]+)([km])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return 0;
  if (m[2] === 'k') return Math.round(n * 1000);
  if (m[2] === 'm') return Math.round(n * 1_000_000);
  return Math.round(n);
}

// Map spoken "mark as X" to an opportunity status/stage patch. Covers both
// statuses ("active", "lost") and stages ("bidding", "design") since reps
// don't always distinguish them in speech.
function mapStatusOrStage(
  target: string,
): { patch: Partial<ExtendedProject>; label: string } | undefined {
  switch (target) {
    case 'active':       return { patch: { opportunityStatus: 'active' },       label: 'active' };
    case 'on hold':
    case 'onhold':
    case 'paused':       return { patch: { opportunityStatus: 'on_hold' },      label: 'on hold' };
    case 'won':          return { patch: { opportunityStatus: 'won', opportunityStage: 'orders_placed', status: 'Won' }, label: 'won' };
    case 'lost':         return { patch: { opportunityStatus: 'lost', opportunityStage: 'closed', status: 'Lost' },      label: 'lost' };
    case 'not pursued':
    case 'no pursuit':
    case 'no go':        return { patch: { opportunityStatus: 'not_pursued', opportunityStage: 'closed' }, label: 'not pursued' };
    case 'lead':
    case 'lead qualification':
    case 'leads':        return { patch: { opportunityStage: 'lead_qualification', status: 'Lead' },       label: 'lead qualification' };
    case 'design':       return { patch: { opportunityStage: 'design', status: 'Active' },                 label: 'design' };
    case 'bidding':
    case 'bid':          return { patch: { opportunityStage: 'bidding', status: 'Bidding' },              label: 'bidding' };
    case 'awarded':      return { patch: { opportunityStage: 'awarded', status: 'Active' },                label: 'awarded' };
    case 'orders pending':
    case 'pending':      return { patch: { opportunityStage: 'orders_pending', status: 'Active' },         label: 'orders pending' };
    case 'orders placed':
    case 'placed':       return { patch: { opportunityStage: 'orders_placed', opportunityStatus: 'won', status: 'Won' }, label: 'orders placed' };
    case 'closed':       return { patch: { opportunityStage: 'closed' },                                    label: 'closed' };
    default:             return undefined;
  }
}

function mapStage(target: string): OpportunityStage | undefined {
  const r = mapStatusOrStage(target);
  return r?.patch.opportunityStage;
}

// Spoken status query response — pulls the most useful fields onto a single
// readable sentence so TTS reads cleanly while driving.
function describeProject(p: ExtendedProject): string {
  const state = useAppStore.getState();
  const customer = state.customers.find((c) => c.id === p.customerId);
  const days = p.lastTouchAt
    ? Math.floor((Date.now() - new Date(p.lastTouchAt).getTime()) / 86400000)
    : Infinity;
  const stageLabel = (p.opportunityStage ?? 'lead_qualification').replace(/_/g, ' ');
  const valueLabel = p.value >= 1_000_000
    ? `$${(p.value / 1_000_000).toFixed(1)} million`
    : p.value >= 1000
    ? `$${Math.round(p.value / 1000)}k`
    : `$${p.value}`;

  const parts: string[] = [];
  parts.push(`${p.name}`);
  if (customer) parts.push(`with ${customer.company}`);
  parts.push(`is in ${stageLabel}`);
  parts.push(`at ${valueLabel}`);
  if (days < Infinity) parts.push(`last touched ${days} days ago`);
  if (p.nextStep) parts.push(`. Next step: ${p.nextStep}`);
  return parts.join(' · ').replace(' · . ', '. ');
}

// ── Scheduling commands ──────────────────────────────────────
// "what's tomorrow look like" / "what's my week look like" / "did I order
// food for the X lunch and learn" — read-only queries against the rep's
// appointment list. TTS-friendly phrasing so the rep can listen while
// driving.
function trySchedulingCommand(text: string): string | null {
  const state = useAppStore.getState();
  const myAppointments = state.appointments.filter(
    (a) => a.repId === state.currentRepId && a.status !== 'cancelled',
  );

  // Food-order status query — high priority because it's so common while
  // driving the morning of an event.
  const foodMatch = text.match(/^did\s+I\s+order\s+(?:the\s+)?food(?:\s+for\s+(.+?))?\??[\s.!]*$/i)
    ?? text.match(/^(?:has|is)\s+(?:the\s+)?food\s+(?:been\s+)?ordered(?:\s+for\s+(.+?))?\??[\s.!]*$/i);
  if (foodMatch) {
    const targetQuery = foodMatch[1]?.trim().toLowerCase();
    const lunchAndLearns = myAppointments.filter((a) =>
      a.type === 'lunch_and_learn' || a.type === 'lunch',
    );
    const candidate = targetQuery
      ? lunchAndLearns.find((a) => {
          const customer = state.customers.find((c) => c.id === a.customerId);
          const hay = `${a.title} ${customer?.company ?? ''} ${a.location ?? ''}`.toLowerCase();
          return hay.includes(targetQuery);
        })
      : lunchAndLearns.find((a) => a.date >= todayKey()) // next upcoming
      ;
    if (!candidate) {
      return targetQuery
        ? `Couldn't find a lunch & learn matching "${targetQuery}".`
        : `No upcoming lunch & learns on the books.`;
    }
    const status = candidate.checklist?.foodOrdered ?? 'pending';
    const customer = state.customers.find((c) => c.id === candidate.customerId);
    const where = customer?.company ?? candidate.title;
    if (status === 'ordered') return `Yes, food's ordered for ${where}.`;
    if (status === 'delivered') return `Food's confirmed delivered for ${where}.`;
    if (status === 'not_needed') return `No food order needed for ${where} — it's not catered.`;
    return `No — food still needs to be ordered for ${where}. ${candidate.notes ?? ''}`.trim();
  }

  // "what's today look like" / "what's tomorrow look like" / "what's my week look like"
  const dayQuery = text.match(/^(?:what'?s|what is|what\s+does)\s+(today|tomorrow|my\s+(?:day|week)|the\s+(?:day|week))\s+(?:look\s+like|on(?:\s+(?:the|my))?\s+(?:calendar|schedule|agenda)|got\s+going)\??[\s.!]*$/i)
    ?? text.match(/^(?:do I have|any)\s+(?:any\s*)?(?:thing|appointments?)\s+(today|tomorrow)\??[\s.!]*$/i)
    ?? text.match(/^(?:what's|what\s+is)\s+(?:on)?\s*(?:my|the)?\s*(today's|tomorrow's|week's)\s+(?:agenda|schedule)\??[\s.!]*$/i);
  if (dayQuery) {
    const scope = dayQuery[1].toLowerCase();
    const now = new Date();
    if (scope.includes('week')) {
      return summarizeWeek(myAppointments, now);
    }
    if (scope.includes('today')) {
      return summarizeDay(myAppointments, now, 'today');
    }
    if (scope.includes('tomorrow')) {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      return summarizeDay(myAppointments, t, 'tomorrow');
    }
    // "what's my day look like" → today
    if (scope.includes('day')) {
      return summarizeDay(myAppointments, now, 'today');
    }
  }

  // "next appointment" / "what's next"
  if (/^(?:what's|what\s+is)\s+(?:my\s+)?next(?:\s+(?:appointment|meeting))?[\s.!?]*$/i.test(text)) {
    const upcoming = myAppointments
      .filter((a) => a.date >= todayKey() && a.status !== 'completed')
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
    const next = upcoming[0];
    if (!next) return "Nothing else on the books.";
    const customer = state.customers.find((c) => c.id === next.customerId);
    return `Next up: ${formatAppointmentForSpeech(next, customer?.company)}.`;
  }

  return null;
}

function todayKey(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

function summarizeDay(
  appointments: ReturnType<typeof useAppStore.getState>['appointments'],
  date: Date,
  label: 'today' | 'tomorrow',
): string {
  const state = useAppStore.getState();
  const key = date.toISOString().slice(0, 10);
  const day = appointments.filter((a) => a.date === key && a.status !== 'completed' && a.status !== 'cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (day.length === 0) return `Nothing on the books ${label}.`;

  const summary = day.map((a) => {
    const customer = state.customers.find((c) => c.id === a.customerId);
    return formatAppointmentForSpeech(a, customer?.company);
  }).join('. ');

  // Surface urgent action items
  const urgent = day.flatMap((a) => {
    const c = a.checklist ?? {};
    const items: string[] = [];
    if ((a.type === 'lunch_and_learn' || a.type === 'lunch') &&
        (c.foodOrdered === 'pending' || c.foodOrdered === undefined)) {
      items.push(`food still needs to be ordered for the ${describeApt(a)}`);
    }
    if ((a.type === 'site_visit' || a.type === 'presentation') && c.samplesShipped === false) {
      items.push(`samples haven't shipped yet for the ${describeApt(a)}`);
    }
    return items;
  });

  let response = `${day.length} appointment${day.length === 1 ? '' : 's'} ${label}. ${summary}`;
  if (urgent.length > 0) {
    response += `. Heads up — ${urgent.join('; ')}.`;
  }
  return response;
}

function summarizeWeek(
  appointments: ReturnType<typeof useAppStore.getState>['appointments'],
  now: Date,
): string {
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(todayMid);
  cutoff.setDate(cutoff.getDate() + 7);
  const upcoming = appointments
    .filter((a) => a.status !== 'completed' && a.status !== 'cancelled')
    .filter((a) => {
      const d = new Date(a.date + 'T12:00:00');
      return d >= todayMid && d < cutoff;
    });
  if (upcoming.length === 0) return "Nothing on the books this week.";

  // Group by date
  const byDate = new Map<string, number>();
  for (const a of upcoming) {
    byDate.set(a.date, (byDate.get(a.date) ?? 0) + 1);
  }
  const dayParts = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => {
    const d = new Date(date + 'T12:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayName}: ${count}`;
  });

  return `${upcoming.length} appointments this week. ${dayParts.join(', ')}.`;
}

function formatAppointmentForSpeech(a: ReturnType<typeof useAppStore.getState>['appointments'][number], customerName?: string): string {
  const [h, m] = a.startTime.split(':').map((n) => parseInt(n, 10));
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const timeStr = m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
  const withWho = customerName ? ` with ${customerName}` : '';
  return `${timeStr} — ${describeApt(a)}${withWho}`;
}

function describeApt(a: ReturnType<typeof useAppStore.getState>['appointments'][number]): string {
  switch (a.type) {
    case 'lunch_and_learn':    return 'lunch & learn';
    case 'presentation':       return 'presentation';
    case 'meeting':            return 'meeting';
    case 'site_visit':         return 'site visit';
    case 'call':               return 'call';
    case 'lunch':              return 'lunch';
    case 'sample_walkthrough': return 'sample walk-through';
    case 'travel':             return 'travel';
    default:                   return 'appointment';
  }
}

// Wraps a dictated body fragment with a sensible greeting + sign-off so the
// voice-dictated reply still reads like a real email. The rep can tap Edit
// for finer control.
function wrapAsReplyBody(fragment: string): string {
  const state = useAppStore.getState();
  const emailId = state.selectedEmailId;
  const email = emailId ? state.emails.find((e) => e.id === emailId) : undefined;
  const rep = state.reps.find((r) => r.id === state.currentRepId) ?? state.reps[0];
  const senderFirst = email?.fromName.split(/\s+/)[0] || 'there';
  const repFirst = rep?.name.split(/\s+/)[0] ?? 'Colton';
  return `Hi ${senderFirst},\n\n${fragment}\n\nThanks,\n${repFirst}`;
}
