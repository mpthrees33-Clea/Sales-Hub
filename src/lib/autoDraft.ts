import { useAppStore } from '../store/useAppStore';
import type {
  EmailDraft, EmailMessage, MissingFieldAsk, EmailIntent, Project, ProjectExtensions,
  Quote,
} from '../types';
import { emails, drafts, threads } from '../services/email';
import { reps } from '../services/reps';
import { projects, suggestCustomerFromEmail } from '../services/projects';
import { activities } from '../services/activities';
import { quotes } from '../services/quotes';
import { buildDraftScaffold } from './emailAI';
import { buildQuote } from './pricing';

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

  // Log activity if we linked to a project.
  if (match) {
    activities.log({
      projectId: match.id,
      repId: rep.id,
      type: 'email_in',
      summary: `Inbound email from ${email.fromName}: ${email.subject}`,
      relatedEmailId: email.id,
      date: email.date,
    });
  }

  return draft;
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
