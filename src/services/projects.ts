import { useAppStore } from '../store/useAppStore';
import type { Project, ProjectExtensions, Bidder, Customer } from '../types';

type ExtendedProject = Project & ProjectExtensions;

// Projects service. Read/write through this module so the eventual backend
// swap is one place. Adds an email-matching helper that the auto-draft
// pipeline uses to link incoming messages to existing opportunities.

export const projects = {
  list(filters?: { repId?: string; status?: string; stage?: string }): ExtendedProject[] {
    const all = useAppStore.getState().projects;
    if (!filters) return all;
    return all.filter((p) => {
      if (filters.repId && p.salesRepId !== filters.repId) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.stage && p.opportunityStage !== filters.stage) return false;
      return true;
    });
  },
  get(id: string): ExtendedProject | undefined {
    return useAppStore.getState().projects.find((p) => p.id === id);
  },
  add(p: ExtendedProject): void {
    useAppStore.getState().addProject(p);
  },
  update(id: string, patch: Partial<ExtendedProject>): void {
    useAppStore.getState().updateProject(id, patch);
  },

  // Find the project most likely referenced by a piece of email text. Used by
  // the auto-draft classifier to link a reply to an existing opportunity. The
  // sender's customer record is the strongest signal (we already know which
  // projects belong to that customer); subject/body name match is a fallback.
  findMatchingForEmail(args: {
    senderEmail: string;
    subject: string;
    body: string;
  }): { match: ExtendedProject | undefined; confidence: number } {
    const state = useAppStore.getState();
    const sender = state.customers.find((c) =>
      c.email.toLowerCase() === args.senderEmail.toLowerCase() ||
      c.contacts.some((ct) => ct.email.toLowerCase() === args.senderEmail.toLowerCase()),
    );

    // 1. Sender is a known customer — match against their projects by name.
    if (sender) {
      const senderProjects = state.projects.filter(
        (p) =>
          p.customerId === sender.id ||
          p.architecturalFirmId === sender.id ||
          p.gcCustomerId === sender.id ||
          p.developerCustomerId === sender.id ||
          p.endUserCustomerId === sender.id,
      );
      const byName = matchByName(senderProjects, args.subject, args.body);
      if (byName) return { match: byName, confidence: 0.9 };
      if (senderProjects.length === 1) return { match: senderProjects[0], confidence: 0.75 };
      // Multiple projects with this sender but no name signal — defer to user.
      return { match: undefined, confidence: 0.4 };
    }

    // 2. Unknown sender — try a name match across all projects.
    const wide = matchByName(state.projects, args.subject, args.body);
    if (wide) return { match: wide, confidence: 0.5 };

    return { match: undefined, confidence: 0 };
  },
};

function matchByName(
  pool: ExtendedProject[],
  subject: string,
  body: string,
): ExtendedProject | undefined {
  const haystack = `${subject} ${body}`.toLowerCase();
  // Prefer longest project name match (more specific).
  const ranked = pool
    .map((p) => ({ p, score: haystack.includes(p.name.toLowerCase()) ? p.name.length : 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.p;
}

// Suggest customer linkage for an email when the sender isn't already in CRM.
// Used by the new-project prompt to pre-fill firm name from the email address
// domain.
export function suggestCustomerFromEmail(email: string): {
  candidate: Customer | undefined;
  domainName?: string;
} {
  const state = useAppStore.getState();
  const lower = email.toLowerCase();
  const direct = state.customers.find(
    (c) =>
      c.email.toLowerCase() === lower ||
      c.contacts.some((ct) => ct.email.toLowerCase() === lower),
  );
  if (direct) return { candidate: direct };

  const domain = lower.split('@')[1];
  if (!domain) return { candidate: undefined };
  const candidate = state.customers.find((c) => {
    const cd = c.email.toLowerCase().split('@')[1];
    return cd && cd === domain;
  });
  return { candidate, domainName: prettifyDomain(domain) };
}

function prettifyDomain(domain: string): string {
  const root = domain.split('.')[0];
  return root.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const bidders = {
  // Auto-add a company to a project's bidder list when we quote them. Used by
  // the quote-send flow.
  addToProject(projectId: string, bidder: Bidder): void {
    const project = projects.get(projectId);
    if (!project) return;
    const existing = project.bidders ?? [];
    // Don't double-add if this customer already has a bidder row.
    if (existing.some((b) => b.customerId === bidder.customerId)) return;
    projects.update(projectId, { bidders: [...existing, bidder] });
  },
  listForProject(projectId: string): Bidder[] {
    return projects.get(projectId)?.bidders ?? [];
  },
};
