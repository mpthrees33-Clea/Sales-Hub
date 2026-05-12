import { useAppStore } from '../store/useAppStore';
import type {
  EmailDraft, EmailMessage, MissingFieldAsk, EmailIntent, Project, ProjectExtensions,
  Quote, Customer,
} from '../types';
import { emails, drafts, threads } from '../services/email';
import { reps } from '../services/reps';
import { projects, suggestCustomerFromEmail } from '../services/projects';
import { activities } from '../services/activities';
import { quotes } from '../services/quotes';
import { buildDraftScaffold, type StakeholderHints } from './emailAI';
import { buildQuote } from './pricing';
import { getCustomerRoles } from '../data/seedData';

// Auto-draft orchestrator. Bridges the LLM pipeline in emailAI.ts with the
// service layer. One entry point — generateDraftForEmail — that:
//   1. Skips if a draft already exists (idempotent)
//   2. Matches the email to a project (high confidence → auto-link)
//   3. Builds the draft scaffold (LLM or fallback)
//   4. Persists as an EmailDraft and logs an Activity
//
// The "needs project link" state fires when project match confidence is low
// AND the intent suggests a real opportunity (new_lead, pricing_request,
// follow_up). The Email page renders a banner that lets the rep create or
// link a project; on resolve, regenerateDraft re-runs with the linked project.

type ExtendedProject = Project & ProjectExtensions;

const PROJECT_LINK_INTENTS = new Set<EmailIntent>([
  'new_lead',
  'pricing_request',
  'follow_up',
  'spec_sheet_request',
]);

const HIGH_CONFIDENCE = 0.7;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface GenerateOptions {
  force?: boolean;          // bypass the existing-draft check
  signal?: AbortSignal;
}

export async function generateDraftForEmail(
  emailId: string,
  opts: GenerateOptions = {},
): Promise<EmailDraft | undefined> {
  const email = emails.get(emailId);
  if (!email) return undefined;
  if (email.folder !== 'inbox') return undefined;

  if (!opts.force) {
    const existing = drafts.getForEmail(emailId);
    if (existing && existing.status !== 'discarded') return existing;
  }

  return generate(email, opts);
}

async function generate(email: EmailMessage, opts: GenerateOptions): Promise<EmailDraft> {
  const state = useAppStore.getState();
  const rep = reps.current();
  const { match, confidence } = projects.findMatchingForEmail({
    senderEmail: email.from,
    subject: email.subject,
    body: email.body,
  });
  const senderCustomer = state.customers.find(
    (c) =>
      c.email.toLowerCase() === email.from.toLowerCase() ||
      c.contacts.some((ct) => ct.email.toLowerCase() === email.from.toLowerCase()),
  );

  // Run the AI scaffold builder. emailAI.ts already falls back deterministically
  // if Gemini isn't configured or errors.
  const scaffold = await buildDraftScaffold(
    {
      email,
      rep,
      matchedProject: match,
      matchedCustomer: senderCustomer,
      brochures: state.brochures,
      products: state.products,
    },
    opts.signal,
  );

  // Determine whether we need a project link before this draft can ship.
  const intentNeedsProject = PROJECT_LINK_INTENTS.has(scaffold.intent);
  const needsProjectLink = intentNeedsProject && (!match || confidence < HIGH_CONFIDENCE);

  // Thread bookkeeping — group reply with the original message.
  const thread = threads.getOrCreate({
    subject: email.subject,
    participantEmails: [email.from, ...email.to],
    customerId: senderCustomer?.id,
    projectId: match?.id,
    lastMessageAt: email.date,
  });

  const now = new Date().toISOString();
  const draftId = newId('drft');
  // Project-level missing fields — computed from the matched project record.
  // Per the user spec, a quote cannot ship without: project_name, architectural
  // firm, GC (if awarded), developer, end user (sometimes), job location.
  const projectMissing: MissingFieldAsk[] = scaffold.intent === 'pricing_request'
    ? buildProjectLevelMissingFields(match)
    : [];

  // Merge LLM/fallback material-level asks with project-level asks.
  const allMissingAsks: MissingFieldAsk[] = [
    ...projectMissing,
    ...(scaffold.missingFieldAsks ?? []),
  ];

  // Pricing engine — build a Quote scaffold for pricing requests.
  let quote: Quote | undefined;
  if (scaffold.intent === 'pricing_request' && scaffold.lineItemRequests?.length) {
    const result = buildQuote({
      repId: rep.id,
      projectId: match?.id,
      customerId: senderCustomer?.id,
      requests: scaffold.lineItemRequests,
      products: state.products,
      priceEntries: state.priceEntries,
    });
    quote = result.quote;
    quotes.add(quote);
  }

  const draft: EmailDraft = {
    id: draftId,
    inReplyToEmailId: email.id,
    threadId: thread.id,
    repId: rep.id,
    createdAt: now,
    updatedAt: now,
    subject: scaffold.subject,
    body: scaffold.body,
    attachedBrochureIds: scaffold.attachBrochureIds,
    intent: scaffold.intent,
    matchedProjectId: match?.id,
    matchedCustomerId: senderCustomer?.id,
    quoteId: quote?.id,
    missingFieldAsks: allMissingAsks,
    isAutoDrafted: true,
    isEdited: false,
    status: needsProjectLink ? 'pending' : 'ready',
  };

  // If there's a previous draft for this email and we're forcing regeneration,
  // mark the old one discarded so the inbox count stays clean.
  const previous = drafts.getForEmail(email.id);
  if (previous && previous.id !== draft.id) {
    drafts.discard(previous.id);
  }

  drafts.add(draft);

  // Log activity + apply email-detected stakeholder hints if we linked to a
  // project. The hints come either from the LLM extraction or a regex
  // fallback. Anything we can match to a CRM customer gets populated on the
  // project (only when the slot is empty), and a note records the source.
  if (match) {
    activities.log({
      projectId: match.id,
      repId: rep.id,
      type: 'email_in',
      summary: `Inbound email from ${email.fromName}: ${email.subject}`,
      relatedEmailId: email.id,
      date: email.date,
    });

    if (scaffold.stakeholderHints) {
      applyStakeholderHints({
        projectId: match.id,
        hints: scaffold.stakeholderHints,
        sourceEmail: email,
        authorName: rep.name,
      });
    }
  }

  return draft;
}

// Match email-detected stakeholder company names against the CRM customer
// list, populate any empty stakeholder slots on the project, and log a note
// documenting where the info came from so the rep can verify.
function applyStakeholderHints(args: {
  projectId: string;
  hints: StakeholderHints;
  sourceEmail: EmailMessage;
  authorName: string;
}): void {
  const state = useAppStore.getState();
  const project = state.projects.find((p) => p.id === args.projectId);
  if (!project) return;

  const customers = state.customers;
  const matches: { role: 'architect' | 'gc' | 'developer' | 'end_user'; customer: Customer; field: keyof ProjectExtensions; mention: string }[] = [];

  function lookupByName(name: string, role: 'architect' | 'gc' | 'developer' | 'end_user'): Customer | undefined {
    const q = name.toLowerCase().trim();
    if (!q) return undefined;
    // Prefer exact then substring matches. Only consider customers whose
    // roles include the target role (so a generic name doesn't pull a wrong
    // customer record).
    const candidates = customers.filter((c) => {
      const roles = getCustomerRoles(c);
      if (roles.includes(role)) return true;
      // Type fallback for unmigrated customers
      if (roles.length === 0) {
        if (role === 'architect') return c.type === 'Architect' || c.type === 'Designer';
        if (role === 'gc') return c.type === 'Contractor';
      }
      return false;
    });
    const exact = candidates.find((c) => c.company.toLowerCase() === q);
    if (exact) return exact;
    return candidates.find((c) => c.company.toLowerCase().includes(q) || q.includes(c.company.toLowerCase()));
  }

  if (args.hints.architect && !project.architecturalFirmId) {
    const c = lookupByName(args.hints.architect, 'architect');
    if (c) matches.push({ role: 'architect', customer: c, field: 'architecturalFirmId', mention: args.hints.architect });
  }
  if (args.hints.gc && !project.gcCustomerId) {
    const c = lookupByName(args.hints.gc, 'gc');
    if (c) matches.push({ role: 'gc', customer: c, field: 'gcCustomerId', mention: args.hints.gc });
  }
  if (args.hints.developer && !project.developerCustomerId) {
    const c = lookupByName(args.hints.developer, 'developer');
    if (c) matches.push({ role: 'developer', customer: c, field: 'developerCustomerId', mention: args.hints.developer });
  }
  if (args.hints.endUser && !project.endUserCustomerId) {
    const c = lookupByName(args.hints.endUser, 'end_user');
    if (c) matches.push({ role: 'end_user', customer: c, field: 'endUserCustomerId', mention: args.hints.endUser });
  }

  if (matches.length === 0) return;

  // Apply each match + log a single note that summarizes all of them.
  const patch: Partial<ProjectExtensions> = {};
  for (const m of matches) {
    (patch as any)[m.field] = m.customer.id;
  }
  projects.update(args.projectId, patch);

  const summary = matches.map((m) => `${roleLabel(m.role)}: ${m.customer.company}`).join('; ');
  const noteText = `Email from ${args.sourceEmail.fromName} indicated — ${summary}. Auto-populated; verify before relying on it.`;
  const note = {
    id: `n-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString().slice(0, 10),
    text: noteText,
    author: args.authorName,
  };
  const fresh = useAppStore.getState().projects.find((p) => p.id === args.projectId);
  if (fresh) {
    useAppStore.getState().updateProject(args.projectId, { notes: [...fresh.notes, note] });
  }
}

function roleLabel(role: 'architect' | 'gc' | 'developer' | 'end_user'): string {
  switch (role) {
    case 'architect': return 'architect';
    case 'gc': return 'GC';
    case 'developer': return 'developer';
    case 'end_user': return 'end user';
  }
}

// Project-level missing-field detection. For pricing requests, the project
// must have a name + architectural firm + GC (if awarded) + developer +
// end user (when applicable) + job location before the quote is allowed
// to ship. Anything blank shows up as a [PLACEHOLDER] + body ask.
function buildProjectLevelMissingFields(match: ExtendedProject | undefined): MissingFieldAsk[] {
  const out: MissingFieldAsk[] = [];

  if (!match) {
    out.push({ field: 'project_name', contextLabel: 'project name' });
    out.push({ field: 'architectural_firm', contextLabel: 'specifying architectural firm' });
    out.push({ field: 'gc', contextLabel: 'general contractor (if awarded)' });
    out.push({ field: 'developer', contextLabel: 'developer' });
    out.push({ field: 'job_location', contextLabel: 'job location' });
    return out;
  }

  if (!match.architecturalFirmId) {
    out.push({ field: 'architectural_firm', contextLabel: 'specifying architectural firm' });
  }
  if (!match.gcCustomerId) {
    out.push({ field: 'gc', contextLabel: 'general contractor (if awarded)' });
  }
  if (!match.developerCustomerId) {
    out.push({ field: 'developer', contextLabel: 'developer' });
  }
  if (!match.jobLocation) {
    out.push({ field: 'job_location', contextLabel: 'job location' });
  }
  return out;
}

function buildNewProjectCandidate(email: EmailMessage): {
  suggestedName: string;
  suggestedFirm?: string;
  suggestedLocation?: string;
  confidence: number;
} {
  // Very simple heuristic. Slice 1 part 1 ships this with regex + sender
  // domain; slice 2 can swap in a smarter LLM-driven extractor.
  const haystack = `${email.subject} ${email.body}`;

  // Subject often *is* the project name (e.g., "RFP: Forsyth multifamily — 240 units").
  const subjectClean = email.subject
    .replace(/^(re:|fwd?:|rfp:|quote request:?)\s*/i, '')
    .replace(/\s+—.*$/, '')
    .trim();
  const suggestedName = subjectClean.length > 4 && subjectClean.length < 80 ? subjectClean : 'New Project';

  // Try to pull a city name out of the body
  const placeMatch = haystack.match(/\b(in|on|at|near)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/);
  const suggestedLocation = placeMatch?.[2];

  const { domainName } = suggestCustomerFromEmail(email.from);

  return {
    suggestedName,
    suggestedFirm: domainName,
    suggestedLocation,
    confidence: 0.5,
  };
}

// Force-regenerate the draft for an email — used after a new-project prompt
// resolution to recompose with the new project context.
export async function regenerateDraft(
  emailId: string,
  opts: GenerateOptions = {},
): Promise<EmailDraft | undefined> {
  return generateDraftForEmail(emailId, { ...opts, force: true });
}

// Linkage helpers used by the new-project prompt.
export function linkDraftToExistingProject(draftId: string, projectId: string): void {
  drafts.update(draftId, {
    matchedProjectId: projectId,
    status: 'ready',
  });
}

export function attachNewProject(args: {
  draftId: string;
  projectName: string;
  customerId: string;
  jobLocation?: string;
}): ExtendedProject | undefined {
  const draft = drafts.get(args.draftId);
  if (!draft) return undefined;
  const rep = reps.current();
  const now = new Date();
  const project: ExtendedProject = {
    id: newId('pr'),
    customerId: args.customerId,
    name: args.projectName,
    description: '',
    status: 'Lead',
    value: 0,
    productIds: [],
    sampleOrderIds: [],
    notes: [],
    createdDate: now.toISOString().slice(0, 10),
    // Extensions
    opportunityId: `OPP-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`,
    salesRepId: rep.id,
    salesLocationId: rep.salesLocationId,
    projectType: 'other',
    opportunityStatus: 'active',
    opportunityStage: 'lead_qualification',
    nextStep: 'Qualify lead and confirm specs',
    updatedDate: now.toISOString(),
    jobLocation: args.jobLocation,
    bidders: [],
    lastTouchAt: now.toISOString(),
  };
  projects.add(project);
  linkDraftToExistingProject(args.draftId, project.id);
  return project;
}

// Recompute new-project candidate metadata for an email + draft. The
// candidate isn't persisted on EmailMessage (no schema migration needed for
// slice 1); we just recompute it on demand for the prompt.
export function getNewProjectCandidateFor(emailId: string): ReturnType<typeof buildNewProjectCandidate> | undefined {
  const email = emails.get(emailId);
  if (!email) return undefined;
  return buildNewProjectCandidate(email);
}
