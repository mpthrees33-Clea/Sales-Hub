import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { X } from 'lucide-react';
import type {
  ProjectExtensions, ProjectType, OpportunityStage, OpportunityStatus,
  Project, Customer, CustomerRole,
} from '../../types';
import SearchableCombobox, { type ComboboxOption } from '../common/SearchableCombobox';
import { getCustomerRoles } from '../../data/seedData';

interface Props { onClose: () => void; }

const PROJECT_TYPES: { key: ProjectType; label: string }[] = [
  { key: 'multifamily', label: 'Multifamily' },
  { key: 'single_family', label: 'Single Family' },
  { key: 'corporate', label: 'Corporate / Office' },
  { key: 'government', label: 'Government' },
  { key: 'community', label: 'Community' },
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'hospitality', label: 'Hospitality' },
  { key: 'retail', label: 'Retail' },
  { key: 'mixed_use', label: 'Mixed Use' },
  { key: 'education', label: 'Education' },
  { key: 'industrial', label: 'Industrial' },
  { key: 'other', label: 'Other' },
];

const STAGES: { key: OpportunityStage; label: string }[] = [
  { key: 'lead_qualification', label: 'Lead Qualification' },
  { key: 'design', label: 'Design' },
  { key: 'bidding', label: 'Bidding' },
  { key: 'awarded', label: 'Awarded' },
  { key: 'orders_pending', label: 'Orders Pending' },
  { key: 'orders_placed', label: 'Orders Placed' },
  { key: 'closed', label: 'Closed' },
];

const STATUSES: { key: OpportunityStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'not_pursued', label: 'Not Pursued' },
];

export default function NewProjectModal({ onClose }: Props) {
  const customers = useAppStore((s) => s.customers);
  const reps = useAppStore((s) => s.reps);
  const currentRepId = useAppStore((s) => s.currentRepId);
  const addProject = useAppStore((s) => s.addProject);

  const currentRep = reps.find((r) => r.id === currentRepId);

  const [form, setForm] = useState({
    customerId: '',
    name: '',
    description: '',
    value: '',
    anticipatedOrderDate: '',
    jobLocation: '',
    projectType: 'other' as ProjectType,
    opportunityStage: 'lead_qualification' as OpportunityStage,
    opportunityStatus: 'active' as OpportunityStatus,
    nextStep: '',
    architecturalFirmId: '',
    gcCustomerId: '',
    developerCustomerId: '',
    endUserCustomerId: '',
  });
  const [error, setError] = useState('');

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.name.trim() || !form.value || !form.anticipatedOrderDate) {
      setError('Customer, name, value, and anticipated order date are required.');
      return;
    }
    const now = new Date();
    const primaryCustomer = customers.find((c) => c.id === form.customerId);
    // Auto-fill stakeholder slots the rep didn't explicitly set, based on
    // the primary customer's roles. E.g. customer is Greer Architecture
    // (role: architect) → architecturalFirmId auto-fills to the customer.
    const primaryRoles = primaryCustomer ? getCustomerRoles(primaryCustomer) : [];
    const autoArchitect = form.architecturalFirmId
      || ((primaryRoles.includes('architect') || primaryCustomer?.type === 'Architect' || primaryCustomer?.type === 'Designer')
          ? form.customerId : '');
    const autoGc = form.gcCustomerId
      || (primaryRoles.includes('gc') ? form.customerId : '');
    const autoDeveloper = form.developerCustomerId
      || (primaryRoles.includes('developer') ? form.customerId : '');
    const autoEndUser = form.endUserCustomerId
      || (primaryRoles.includes('end_user') ? form.customerId : '');

    const newProject: Project & ProjectExtensions = {
      id: `pr-${Date.now()}`,
      customerId: form.customerId,
      name: form.name.trim(),
      description: form.description.trim(),
      value: parseFloat(form.value),
      anticipatedOrderDate: form.anticipatedOrderDate,
      status: form.opportunityStatus === 'won' ? 'Won'
        : form.opportunityStatus === 'lost' ? 'Lost'
        : form.opportunityStage === 'bidding' ? 'Bidding'
        : form.opportunityStage === 'lead_qualification' ? 'Lead'
        : 'Active',
      productIds: [],
      sampleOrderIds: [],
      notes: [],
      createdDate: now.toISOString().slice(0, 10),
      // Extensions
      opportunityId: `OPP-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`,
      salesRepId: currentRep?.id ?? 'rep-sarah',
      salesLocationId: currentRep?.salesLocationId ?? '310',
      projectType: form.projectType,
      opportunityStatus: form.opportunityStatus,
      opportunityStage: form.opportunityStage,
      nextStep: form.nextStep.trim() || undefined,
      updatedDate: now.toISOString(),
      jobLocation: form.jobLocation.trim() || undefined,
      architecturalFirmId: autoArchitect || undefined,
      gcCustomerId: autoGc || undefined,
      developerCustomerId: autoDeveloper || undefined,
      endUserCustomerId: autoEndUser || undefined,
      bidders: [],
      lastTouchAt: now.toISOString(),
    };
    addProject(newProject);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider shrink-0">
          <div>
            <h2 className="font-semibold text-fg">New Opportunity</h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Rep: {currentRep?.name ?? '—'} · Location: {currentRep?.salesLocationId ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-1"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto">
          {error && <p className="text-xs text-danger bg-danger/10 px-3 py-2 rounded">{error}</p>}

          {/* ── Identity ── */}
          <Section title="Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Customer *">
                <Select value={form.customerId} onChange={(v) => set('customerId', v)}
                  options={[{ value: '', label: 'Select customer…' }, ...customers.map((c) => ({ value: c.id, label: `${c.company} (${c.type})` }))]} />
              </Field>
              <Field label="Project Name *">
                <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Buckhead Tower Lobby" />
              </Field>
            </div>
            <Field label="Description">
              <textarea className={inputCls + ' resize-none'} rows={2}
                value={form.description} onChange={(e) => set('description', e.target.value)}
                placeholder="Scope, location, key details…" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Project Type">
                <Select value={form.projectType} onChange={(v) => set('projectType', v as ProjectType)}
                  options={PROJECT_TYPES.map((t) => ({ value: t.key, label: t.label }))} />
              </Field>
              <Field label="Stage">
                <Select value={form.opportunityStage} onChange={(v) => set('opportunityStage', v as OpportunityStage)}
                  options={STAGES.map((s) => ({ value: s.key, label: s.label }))} />
              </Field>
              <Field label="Status">
                <Select value={form.opportunityStatus} onChange={(v) => set('opportunityStatus', v as OpportunityStatus)}
                  options={STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
              </Field>
            </div>
          </Section>

          {/* ── Money & Dates ── */}
          <Section title="Money & Dates">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Project Value ($) *">
                <input type="number" min="0" step="100" className={inputCls}
                  value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="50000" />
              </Field>
              <Field label="Anticipated Order *">
                <input type="date" className={inputCls}
                  value={form.anticipatedOrderDate} onChange={(e) => set('anticipatedOrderDate', e.target.value)} />
              </Field>
            </div>
            <Field label="Job Location">
              <input className={inputCls} value={form.jobLocation}
                onChange={(e) => set('jobLocation', e.target.value)} placeholder="City, state" />
            </Field>
          </Section>

          {/* ── Stakeholders ── */}
          <Section title="Stakeholders (optional)">
            <p className="text-xs text-fg-faint -mt-1 mb-1">
              Each picker is filtered to customers who play that role. GC + End User include a "Same as developer" option for design-build firms.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Architect">
                <StakeholderCombobox role="architect" value={form.architecturalFirmId}
                  onChange={(v) => set('architecturalFirmId', v)} customers={customers}
                  developerId={form.developerCustomerId} />
              </Field>
              <Field label="GC">
                <StakeholderCombobox role="gc" value={form.gcCustomerId}
                  onChange={(v) => set('gcCustomerId', v)} customers={customers}
                  developerId={form.developerCustomerId} />
              </Field>
              <Field label="Developer">
                <StakeholderCombobox role="developer" value={form.developerCustomerId}
                  onChange={(v) => set('developerCustomerId', v)} customers={customers}
                  developerId={form.developerCustomerId} />
              </Field>
              <Field label="End User">
                <StakeholderCombobox role="end_user" value={form.endUserCustomerId}
                  onChange={(v) => set('endUserCustomerId', v)} customers={customers}
                  developerId={form.developerCustomerId} />
              </Field>
            </div>
          </Section>

          {/* ── Next step ── */}
          <Field label="Next Step">
            <input className={inputCls} value={form.nextStep}
              onChange={(e) => set('nextStep', e.target.value)} placeholder="e.g. Schedule lunch & learn with spec team" />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-divider">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted rounded-lg hover:bg-surface-1">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim">Create Opportunity</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">{title}</p>
      <div className="space-y-3">{children}</div>
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

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Role-filtered searchable picker shared by all 4 stakeholder slots in the
// new-opportunity form. Same component is used in ProjectDetailPanel.
function StakeholderCombobox({
  role, value, onChange, customers, developerId,
}: {
  role: CustomerRole;
  value: string;
  onChange: (v: string) => void;
  customers: Customer[];
  developerId: string;
}) {
  const options = useMemo<ComboboxOption[]>(() => {
    const eligible = customers.filter((c) => {
      const roles = getCustomerRoles(c);
      if (roles.includes(role)) return true;
      if (roles.length === 0) {
        if (role === 'architect') return c.type === 'Architect' || c.type === 'Designer';
        if (role === 'gc') return c.type === 'Contractor';
        if (role === 'end_user') return true;
      }
      return false;
    });
    eligible.sort((a, b) => a.company.localeCompare(b.company));
    const opts: ComboboxOption[] = eligible.map((c) => ({
      value: c.id,
      label: c.company,
      sublabel: `${c.contacts[0]?.name ?? c.name} · ${c.type}`,
    }));
    // GC + End User get "Same as developer" pinned when relevant.
    if ((role === 'gc' || role === 'end_user') && developerId && developerId !== value) {
      const dev = customers.find((c) => c.id === developerId);
      if (dev) {
        opts.unshift({
          value: developerId,
          label: `Same as developer (${dev.company})`,
          sublabel: 'Design-build / same-firm pattern',
          pinned: true,
        });
      }
    }
    return opts;
  }, [customers, role, developerId, value]);

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="— Not assigned —"
    />
  );
}
