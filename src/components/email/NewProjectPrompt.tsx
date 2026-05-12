import { useMemo, useState } from 'react';
import { FolderPlus, Link2, X } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type { EmailDraft, EmailMessage } from '../../types';
import {
  attachNewProject,
  linkDraftToExistingProject,
  regenerateDraft,
  getNewProjectCandidateFor,
} from '../../lib/autoDraft';
import { drafts as draftsService } from '../../services/email';

// Banner + modal flow for the "this email mentions a new project" case. The
// banner sits above the email body when draft.status === 'pending'. Three
// resolutions:
//   1. Add new project (pre-fills from sender domain + subject heuristics)
//   2. Link to existing (project picker)
//   3. Skip (mark draft as ready, leave matchedProjectId empty)

interface Props {
  draft: EmailDraft;
  email: EmailMessage;
  onResolved: () => void;
}

type Modal = 'none' | 'create' | 'link';

export default function NewProjectPrompt({ draft, email, onResolved }: Props) {
  const customers = useAppStore((s) => s.customers);
  const projects = useAppStore((s) => s.projects);
  const [modal, setModal] = useState<Modal>('none');

  const candidate = useMemo(() => getNewProjectCandidateFor(email.id), [email.id]);

  // Pre-fill customer suggestion via sender domain.
  const senderDomain = email.from.split('@')[1];
  const suggestedCustomer = senderDomain
    ? customers.find((c) => c.email.toLowerCase().endsWith('@' + senderDomain))
    : undefined;

  function skip() {
    draftsService.update(draft.id, { status: 'ready' });
    onResolved();
  }

  async function handleCreate(args: { projectName: string; customerId: string; jobLocation?: string }) {
    const project = attachNewProject({
      draftId: draft.id,
      projectName: args.projectName,
      customerId: args.customerId,
      jobLocation: args.jobLocation,
    });
    if (!project) return;
    // Regenerate the body with the new project in context.
    await regenerateDraft(draft.inReplyToEmailId);
    setModal('none');
    onResolved();
  }

  async function handleLink(projectId: string) {
    linkDraftToExistingProject(draft.id, projectId);
    await regenerateDraft(draft.inReplyToEmailId);
    setModal('none');
    onResolved();
  }

  return (
    <>
      <div className="bg-warning/10 border border-warning/40 rounded-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-warning/20 border border-warning/40 flex items-center justify-center shrink-0">
          <FolderPlus size={16} className="text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg">
            This email doesn't match an existing project. New opportunity?
          </p>
          <p className="text-xs text-fg-muted mt-1">
            {candidate?.suggestedName && (
              <>Suggested project name: <span className="text-fg-muted italic">"{candidate.suggestedName}"</span>. </>
            )}
            Link this thread to a project so the auto-draft has full context.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={() => setModal('create')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim"
            >
              <FolderPlus size={13} />
              Add new project
            </button>
            <button
              onClick={() => setModal('link')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface-2 text-fg border border-divider rounded-lg hover:bg-accent/10 hover:border-accent/40"
            >
              <Link2 size={13} />
              Link to existing
            </button>
            <button
              onClick={skip}
              className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg-faint"
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      {modal === 'create' && (
        <CreateProjectModal
          email={email}
          suggestedName={candidate?.suggestedName ?? ''}
          suggestedLocation={candidate?.suggestedLocation}
          suggestedCustomerId={suggestedCustomer?.id}
          suggestedDomainFirm={candidate?.suggestedFirm}
          customers={customers}
          onCancel={() => setModal('none')}
          onCreate={handleCreate}
        />
      )}
      {modal === 'link' && (
        <LinkProjectModal
          projects={projects}
          onCancel={() => setModal('none')}
          onLink={handleLink}
        />
      )}
    </>
  );
}

// ── Create-project modal ───────────────────────────────────────
function CreateProjectModal({
  email,
  suggestedName,
  suggestedLocation,
  suggestedCustomerId,
  suggestedDomainFirm,
  customers,
  onCancel,
  onCreate,
}: {
  email: EmailMessage;
  suggestedName: string;
  suggestedLocation: string | undefined;
  suggestedCustomerId: string | undefined;
  suggestedDomainFirm: string | undefined;
  customers: ReturnType<typeof useAppStore.getState>['customers'];
  onCancel: () => void;
  onCreate: (args: { projectName: string; customerId: string; jobLocation?: string }) => void;
}) {
  const [projectName, setProjectName] = useState(suggestedName);
  const [customerId, setCustomerId] = useState(suggestedCustomerId ?? '');
  const [jobLocation, setJobLocation] = useState(suggestedLocation ?? '');

  return (
    <ModalShell title="Add new project" onClose={onCancel}>
      <div className="space-y-3 text-sm">
        <Field label="Project name">
          <input
            className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. Decatur Courthouse Renovation"
          />
        </Field>
        <Field label="Customer">
          <select
            className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.company} — {c.name}</option>
            ))}
          </select>
          {!suggestedCustomerId && suggestedDomainFirm && (
            <p className="text-xs text-fg-faint mt-1">
              Sender domain suggests "{suggestedDomainFirm}" — add them to CRM in the customer list if missing.
            </p>
          )}
        </Field>
        <Field label="Job location (optional)">
          <input
            className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            value={jobLocation}
            onChange={(e) => setJobLocation(e.target.value)}
            placeholder="City, state"
          />
        </Field>
        <p className="text-xs text-fg-faint">
          Triggered by email from {email.fromName} &lt;{email.from}&gt;
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-fg-muted border border-divider rounded-lg hover:bg-surface-1"
          >
            Cancel
          </button>
          <button
            disabled={!projectName.trim() || !customerId}
            onClick={() => onCreate({ projectName: projectName.trim(), customerId, jobLocation: jobLocation.trim() || undefined })}
            className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create & link
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Link-existing modal ────────────────────────────────────────
function LinkProjectModal({
  projects,
  onCancel,
  onLink,
}: {
  projects: ReturnType<typeof useAppStore.getState>['projects'];
  onCancel: () => void;
  onLink: (projectId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects.slice(0, 30);
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.jobLocation ?? '').toLowerCase().includes(q),
    ).slice(0, 30);
  }, [query, projects]);

  return (
    <ModalShell title="Link to existing project" onClose={onCancel}>
      <input
        autoFocus
        className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent mb-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or location…"
      />
      <div className="max-h-72 overflow-y-auto border border-divider rounded-lg divide-y divide-divider">
        {filtered.length === 0 ? (
          <div className="p-3 text-sm text-fg-faint">No projects match.</div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onLink(p.id)}
              className="w-full text-left px-3 py-2 hover:bg-accent/10 transition-colors"
            >
              <p className="text-sm font-medium text-fg">{p.name}</p>
              <p className="text-xs text-fg-muted">
                {p.status}{p.opportunityStage ? ` · ${p.opportunityStage.replace(/_/g, ' ')}` : ''}
                {p.jobLocation ? ` · ${p.jobLocation}` : ''}
              </p>
            </button>
          ))
        )}
      </div>
      <div className="flex justify-end pt-3">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-fg-muted border border-divider rounded-lg hover:bg-surface-1"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal shell ────────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={clsx(
          'relative w-full max-w-md bg-surface border border-divider rounded-xl shadow-2xl',
          'flex flex-col overflow-hidden',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-1 hover:text-fg">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-fg-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
