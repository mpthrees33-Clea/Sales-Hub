import { useState } from 'react';
import { Link2, X, Building2, HardHat, Briefcase, MapPin, DollarSign, CalendarClock, FileText } from 'lucide-react';
import clsx from 'clsx';
import type { Project, ProjectExtensions } from '../../types';
import { lookupCmdProject, type CmdProjectData } from '../../lib/mockCmd';

type ExtendedProject = Project & ProjectExtensions;

interface Props {
  project: ExtendedProject;
  onClose: () => void;
  onApply: (patch: Partial<ExtendedProject>) => void;
}

// CMD / ConstructConnect link modal. Takes a CMD project ID, runs a mock
// lookup (deterministic — same ID → same data), shows a preview of the
// returned fields, lets the rep pick which ones to apply to the project.
// When the real CMD API lands, swap mockCmd.lookupCmdProject for a backend
// fetch; everything else here stays.
export default function CmdLinkModal({ project, onClose, onApply }: Props) {
  const [cmdId, setCmdId] = useState(project.cmdProjectId ?? '');
  const [preview, setPreview] = useState<CmdProjectData | undefined>();
  const [error, setError] = useState('');
  const [picks, setPicks] = useState({
    jobLocation: true,
    estimatedValue: true,
    anticipatedOrderDate: true,
    projectType: true,
    scopeSummary: true,
    stakeholders: true,
  });

  function lookup() {
    setError('');
    const data = lookupCmdProject(cmdId);
    if (!data) {
      setError('Enter a CMD project ID first.');
      setPreview(undefined);
      return;
    }
    setPreview(data);
  }

  function apply() {
    if (!preview) return;
    const patch: Partial<ExtendedProject> = { cmdProjectId: preview.cmdProjectId };
    if (picks.jobLocation) patch.jobLocation = preview.jobLocation;
    if (picks.estimatedValue) patch.value = preview.estimatedValue;
    if (picks.anticipatedOrderDate) patch.anticipatedOrderDate = preview.anticipatedOrderDate;
    if (picks.projectType) patch.projectType = preview.projectType;
    if (picks.scopeSummary) patch.description = preview.scopeSummary;
    // Stakeholder pulls go into the project description footnote — we don't
    // auto-assign to customer records since the rep needs to verify those
    // exist in CRM first. The names are still surfaced in the description.
    if (picks.stakeholders) {
      const summary = patch.description ?? project.description ?? '';
      const tag = `\n\n— CMD ${preview.cmdProjectId} — Architect: ${preview.architectName} · GC: ${preview.gcName} · Developer: ${preview.developerName}`;
      patch.description = summary + tag;
    }
    onApply(patch);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider shrink-0">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-accent-light" />
            <h2 className="font-semibold text-fg">Link ConstructConnect / CMD project</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-1"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-fg-muted">
            Enter the CMD project ID. We'll pull project metadata (location, value, stakeholders, scope) and
            you pick what to apply to this opportunity.
          </p>

          {/* Input + lookup */}
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              placeholder="e.g. CMD-1208473"
              value={cmdId}
              onChange={(e) => setCmdId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
            />
            <button
              onClick={lookup}
              className="px-3 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim disabled:opacity-40"
              disabled={!cmdId.trim()}
            >
              Look up
            </button>
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger/10 px-3 py-2 rounded">{error}</p>
          )}

          {/* Preview */}
          {preview && (
            <div className="border border-divider rounded-lg bg-bg p-3 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-fg">{preview.projectName}</p>
                <p className="text-xs text-fg-faint font-mono">{preview.cmdProjectId}</p>
              </div>
              <PreviewRow icon={MapPin}        label="Job location"   value={preview.jobLocation}      picked={picks.jobLocation}        onToggle={() => setPicks((p) => ({ ...p, jobLocation: !p.jobLocation }))} />
              <PreviewRow icon={DollarSign}    label="Estimated value" value={`$${preview.estimatedValue.toLocaleString()}`} picked={picks.estimatedValue} onToggle={() => setPicks((p) => ({ ...p, estimatedValue: !p.estimatedValue }))} />
              <PreviewRow icon={CalendarClock} label="Anticipated order" value={preview.anticipatedOrderDate} picked={picks.anticipatedOrderDate} onToggle={() => setPicks((p) => ({ ...p, anticipatedOrderDate: !p.anticipatedOrderDate }))} />
              <PreviewRow icon={FileText}      label="Type"            value={preview.projectType.replace(/_/g, ' ')} picked={picks.projectType} onToggle={() => setPicks((p) => ({ ...p, projectType: !p.projectType }))} />
              <PreviewRow icon={Briefcase}     label="Architect"       value={preview.architectName}    picked={picks.stakeholders} onToggle={() => setPicks((p) => ({ ...p, stakeholders: !p.stakeholders }))} small />
              <PreviewRow icon={HardHat}       label="GC"              value={preview.gcName}           picked={picks.stakeholders} onToggle={() => setPicks((p) => ({ ...p, stakeholders: !p.stakeholders }))} small />
              <PreviewRow icon={Building2}     label="Developer"       value={preview.developerName}    picked={picks.stakeholders} onToggle={() => setPicks((p) => ({ ...p, stakeholders: !p.stakeholders }))} small />
              <PreviewRow icon={FileText}      label="Scope"           value={preview.scopeSummary}     picked={picks.scopeSummary} onToggle={() => setPicks((p) => ({ ...p, scopeSummary: !p.scopeSummary }))} multiline />
              <p className="text-xs text-fg-faint italic pt-1 border-t border-divider/60">
                Stakeholder names will be appended to the project description; we don't auto-link to CRM customers
                so you can confirm the exact records first.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-divider shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-fg-muted border border-divider rounded-lg hover:bg-surface-1">
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!preview}
            className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply to project
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  icon: Icon,
  label,
  value,
  picked,
  onToggle,
  small,
  multiline,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  picked: boolean;
  onToggle: () => void;
  small?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className={clsx('flex gap-2 cursor-pointer', multiline ? 'items-start' : 'items-center')}>
      <input type="checkbox" checked={picked} onChange={onToggle} className="mt-1 accent-accent" />
      <div className="flex items-center gap-1.5 text-fg-faint text-xs shrink-0 w-32">
        <Icon size={11} />
        <span>{label}</span>
      </div>
      <span className={clsx('flex-1 text-fg', small ? 'text-xs' : 'text-sm', multiline && 'leading-relaxed')}>
        {value}
      </span>
    </label>
  );
}
