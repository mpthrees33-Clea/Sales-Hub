import { useAppStore } from '../store/useAppStore';
import type {
  DormantDigest, DormantAccountEntry, EmailMessage, Customer, Rep,
} from '../types';
import { dormant, mondayOf } from '../services/dormant';
import { reps } from '../services/reps';
import { emails } from '../services/email';

// Weekly dormant-account digest generator. Builds drafts (in the drafts
// folder) for the top 10 dormant accounts, plus a system "Weekly Dormant
// Account Review" email that lands in the rep's inbox so they see it
// alongside everything else on Monday.
//
// Idempotent per week — if a digest already exists for this rep + this
// Monday, returns the existing one.

const SYSTEM_FROM = 'system@trinity-hub.internal';
const SYSTEM_NAME = 'Trinity Sales Hub';

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function maybeGenerateMondayDigest(repId: string, now: Date = new Date()): DormantDigest | undefined {
  // Generate any time it's Monday (or no digest exists for this week yet).
  // For the demo we always generate on first visit of the week, regardless
  // of day — the rep can see the digest immediately rather than waiting.
  const existing = dormant.getThisWeek(repId, now);
  if (existing) return existing;
  return generateDormantDigest(repId, now);
}

export function generateDormantDigest(repId: string, now: Date = new Date()): DormantDigest | undefined {
  const state = useAppStore.getState();
  const rep = reps.get(repId);
  if (!rep) return undefined;

  const entries = dormant.computeThisWeek(repId, now);
  if (!entries.length) return undefined;

  const weekOf = mondayOf(now);

  // Generate per-account re-engagement drafts (in the existing drafts folder).
  // Templated by customer type — design firms get a lunch & learn pitch,
  // contractors / end users get a check-in, dealers get a new-opportunity
  // pitch. Keeps cost predictable (no LLM calls in this path).
  const enriched: DormantAccountEntry[] = entries.map((entry) => {
    const customer = state.customers.find((c) => c.id === entry.customerId);
    if (!customer) return entry;
    const draftEmail = buildReEngagementDraft({
      rep,
      customer,
      entry,
      now,
    });
    emails.add(draftEmail);
    return { ...entry, draftEmailId: draftEmail.id };
  });

  // Generate the system "Weekly Dormant Account Review" email — lands in
  // the rep's inbox so the workflow feels like an email they'd actually
  // get from a sales operations system.
  const inboxEmail = buildDigestInboxEmail({ rep, entries: enriched, weekOf, now });
  emails.add(inboxEmail);

  const digest: DormantDigest = {
    id: newId('dig'),
    repId,
    weekOf,
    generatedAt: now.toISOString(),
    entries: enriched,
    sentAsEmailId: inboxEmail.id,
  };
  dormant.save(digest);
  return digest;
}

interface DraftArgs {
  rep: Rep;
  customer: Customer;
  entry: DormantAccountEntry;
  now: Date;
}

function buildReEngagementDraft(args: DraftArgs): EmailMessage {
  const { rep, customer, entry, now } = args;
  const repFirst = rep.name.split(/\s+/)[0];
  const contactName = customer.contacts.find((c) => c.isPrimary)?.name ?? customer.name;
  const contactFirst = contactName.split(/\s+/)[0];
  const contactEmail = customer.contacts.find((c) => c.isPrimary)?.email ?? customer.email;

  const days = entry.daysDormant;
  const pastVal = entry.pastOpportunityValue >= 100000
    ? `$${Math.round(entry.pastOpportunityValue / 1000)}k`
    : `$${(entry.pastOpportunityValue / 1000).toFixed(0)}k`;

  let subject: string;
  let body: string;

  switch (entry.templateType) {
    case 'lunch_and_learn':
      subject = `Checking in — Trinity lunch & learn?`;
      body = `Hi ${contactFirst},\n\nIt's been a few months since we last connected. We've had a busy quarter on the spec side — Trinity rolled out new commercial SPC and updated tile collections that have been getting strong reception with firms doing similar work to yours.\n\nWould love to come by for a lunch & learn so your team can see the new line. I can bring lunch and we'd keep it to about 45 minutes. Any chance one of the next few Tuesdays or Thursdays would work?\n\nLet me know what fits.\n\nThanks,\n${repFirst}`;
      break;
    case 'presentation_invite':
      subject = `Trinity update for your team`;
      body = `Hi ${contactFirst},\n\nWanted to circle back — it's been about ${days} days since we last touched base and Trinity has a few new collections worth showing your designers. Happy to put together a short presentation (~30 minutes) tailored to the kind of projects you've been working on.\n\nAny week in the next month or so that we could swing by?\n\nThanks,\n${repFirst}`;
      break;
    case 'check_in':
      subject = `How's the pipeline looking?`;
      body = `Hey ${contactFirst},\n\nIt's been a while — wanted to check in on how things are going on your side. We've expanded the LVP and commercial carpet lines this year and have some new product literature if you have any upcoming projects that need bids.\n\nAlso happy to bring samples to your office if there's a specific job we should look at together.\n\nThanks,\n${repFirst}`;
      break;
    case 'new_opportunity':
      subject = `New Trinity products for the showroom?`;
      body = `Hey ${contactFirst},\n\nIt's been ${days} days since we last connected — wanted to flag some new product lines Trinity added this year, including a refreshed commercial SPC offering and a new tile collection. Both have been moving well at other showrooms.\n\nHappy to set up a visit or send updated samples — let me know what's helpful.\n\nThanks,\n${repFirst}`;
      break;
    default:
      subject = `Checking in`;
      body = `Hi ${contactFirst},\n\nIt's been a few months since we last connected — wanted to check in and see if there's anything coming up where Trinity could help. Happy to send updated literature or set up a call.\n\nThanks,\n${repFirst}`;
  }

  // Note past value in a subtle tag — visible only when the rep edits.
  body += `\n\n--\n[Dormant digest auto-draft · last touch ${days}d ago · past opportunity ${pastVal}]`;

  return {
    id: newId('em-dig'),
    folder: 'drafts',
    isRead: true,
    isStarred: false,
    from: rep.email,
    fromName: rep.name,
    to: [contactEmail],
    subject,
    body,
    date: now.toISOString(),
    attachedBrochureIds: [],
  };
}

function buildDigestInboxEmail(args: {
  rep: Rep;
  entries: DormantAccountEntry[];
  weekOf: string;
  now: Date;
}): EmailMessage {
  const { rep, entries, weekOf, now } = args;
  const repFirst = rep.name.split(/\s+/)[0];
  const weekLabel = new Date(weekOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const lines = entries.map((e, i) => {
    const valLabel = e.pastOpportunityValue >= 1_000_000
      ? `$${(e.pastOpportunityValue / 1_000_000).toFixed(1)}M`
      : `$${Math.round(e.pastOpportunityValue / 1000)}k`;
    const templateLabel = templateTypeLabel(e.templateType);
    return `${i + 1}. ${e.customerName} (${e.customerType}) — ${e.daysDormant}d dormant · ${valLabel} past · ${templateLabel} draft ready`;
  }).join('\n');

  const draftCount = entries.filter((e) => e.draftEmailId).length;

  const body = `Hi ${repFirst},\n\nYour weekly dormant-account review for the week of ${weekLabel}.\n\nThese are the 10 largest accounts on your pipeline where nothing has moved in 90+ days. I've already drafted re-engagement emails for each — they're sitting in your Drafts folder, ready to review and send.\n\n${lines}\n\n${draftCount} re-engagement drafts are ready in your Drafts folder. Review, tune, and send the ones that fit.\n\n— Trinity Sales Hub`;

  return {
    id: newId('em-sys'),
    folder: 'inbox',
    isRead: false,
    isStarred: true,
    from: SYSTEM_FROM,
    fromName: SYSTEM_NAME,
    to: [rep.email],
    subject: `Weekly Dormant Account Review — week of ${weekLabel}`,
    body,
    date: now.toISOString(),
    attachedBrochureIds: [],
  };
}

function templateTypeLabel(t: DormantAccountEntry['templateType']): string {
  switch (t) {
    case 'lunch_and_learn': return 'lunch & learn';
    case 'presentation_invite': return 'presentation invite';
    case 'check_in': return 'check-in';
    case 'new_opportunity': return 'new opportunity';
  }
}
