import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Star, Paperclip, Send, FileText, Search, Calculator, Zap, ChevronLeft, Pencil } from 'lucide-react';
import type { EmailMessage } from '../types';
import clsx from 'clsx';
import AutoDraftPanel from '../components/email/AutoDraftPanel';
import NewProjectPrompt from '../components/email/NewProjectPrompt';
import { drafts as draftsService } from '../services/email';
import { generateDraftForEmail, regenerateDraft } from '../lib/autoDraft';

type Folder = 'inbox' | 'sent' | 'drafts' | 'trash';
const FOLDERS: { key: Folder; label: string }[] = [
  { key: 'inbox', label: 'Inbox' }, { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' }, { key: 'trash', label: 'Trash' },
];

// ── AI Tools Panel ─────────────────────────────────────────
function AIToolsPanel({ onAttach }: { onAttach: (id: string) => void }) {
  const { products, brochures } = useAppStore();
  const [lookup, setLookup] = useState('');
  const [quoteProduct, setQuoteProduct] = useState('');
  const [sqft, setSqft] = useState('');
  const [brochureSearch, setBrochureSearch] = useState('');

  const lookupResults = lookup.length >= 2 ? products.filter((p) => {
    const q = lookup.toLowerCase();
    return p.trinityName.toLowerCase().includes(q) || p.trinitySku.toLowerCase().includes(q) ||
      p.privateLabels.some((pl) => pl.brand.toLowerCase().includes(q) || pl.productName.toLowerCase().includes(q));
  }).slice(0, 3) : [];

  const quoteResult = (() => {
    const p = products.find((x) => x.id === quoteProduct);
    const sf = parseFloat(sqft);
    if (!p || !sf || isNaN(sf)) return null;
    const withWaste = sf * 1.1;
    return { product: p, sqft: withWaste.toFixed(0), total: (withWaste * p.listPrice).toFixed(2) };
  })();

  const filteredBrochures = brochureSearch.length >= 2
    ? brochures.filter((b) => b.name.toLowerCase().includes(brochureSearch.toLowerCase()) || b.brand.toLowerCase().includes(brochureSearch.toLowerCase())).slice(0, 5)
    : [];

  const TEMPLATES = [
    { keyword: 'quote', label: 'Quote Follow-Up', body: 'Thank you for your interest! I wanted to follow up on the quote I sent over. Please let me know if you have any questions or need any adjustments.' },
    { keyword: 'spec', label: 'Spec Sheet Response', body: 'Hi, I\'ve attached the specification sheet for the products you requested. Please don\'t hesitate to reach out if you need additional technical details.' },
    { keyword: 'sample', label: 'Sample Arrival', body: 'Great news — your samples should be arriving shortly! Once you\'ve had a chance to review them, I\'d love to hear your thoughts and next steps.' },
  ];

  return (
    <div className="w-64 border-l border-divider flex flex-col overflow-y-auto bg-bg">
      <div className="px-3 py-2 border-b border-divider flex items-center gap-1.5">
        <Zap size={14} className="text-accent-light" />
        <span className="text-xs font-semibold text-fg">AI Tools</span>
      </div>

      {/* Product Lookup */}
      <div className="px-3 py-3 border-b border-divider">
        <p className="text-xs font-medium text-fg-muted mb-1.5 flex items-center gap-1"><Search size={11} /> Product Lookup</p>
        <input className="w-full text-xs border border-divider rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
          placeholder="Any name or brand…" value={lookup} onChange={(e) => setLookup(e.target.value)} />
        {lookupResults.map((p) => (
          <div key={p.id} className="mt-1.5 bg-surface border border-divider rounded p-2 text-xs">
            <p className="font-medium text-fg">{p.trinityName}</p>
            <p className="text-fg-faint">{p.category} · ${p.listPrice}/{p.unit}</p>
            <p className="text-fg-faint truncate">{p.privateLabels.map((pl) => pl.brand).join(', ')}</p>
          </div>
        ))}
      </div>

      {/* Attach Brochure */}
      <div className="px-3 py-3 border-b border-divider">
        <p className="text-xs font-medium text-fg-muted mb-1.5 flex items-center gap-1"><Paperclip size={11} /> Attach Brochure</p>
        <input className="w-full text-xs border border-divider rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
          placeholder="Search brochures…" value={brochureSearch} onChange={(e) => setBrochureSearch(e.target.value)} />
        {filteredBrochures.map((b) => (
          <button key={b.id} onClick={() => { onAttach(b.id); setBrochureSearch(''); }}
            className="w-full text-left mt-1 px-2 py-1.5 text-xs bg-surface border border-divider rounded hover:bg-accent/10 hover:border-accent/40 truncate text-fg">
            + {b.name}
          </button>
        ))}
      </div>

      {/* Quick Quote */}
      <div className="px-3 py-3 border-b border-divider">
        <p className="text-xs font-medium text-fg-muted mb-1.5 flex items-center gap-1"><Calculator size={11} /> Quick Quote</p>
        <select className="w-full text-xs border border-divider rounded px-2 py-1.5 mb-1.5 focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
          value={quoteProduct} onChange={(e) => setQuoteProduct(e.target.value)}>
          <option value="">Select product…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.trinityName}</option>)}
        </select>
        <input type="number" className="w-full text-xs border border-divider rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
          placeholder="Square footage" value={sqft} onChange={(e) => setSqft(e.target.value)} />
        {quoteResult && (
          <div className="mt-1.5 bg-accent/10 border border-accent/30 rounded p-2 text-xs">
            <p className="text-accent-light font-medium">{quoteResult.sqft} sq ft (w/ 10% waste)</p>
            <p className="text-accent-light font-bold">${quoteResult.total} list</p>
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="px-3 py-3">
        <p className="text-xs font-medium text-fg-muted mb-1.5 flex items-center gap-1"><FileText size={11} /> Templates</p>
        {TEMPLATES.map((t) => (
          <button key={t.keyword} onClick={() => navigator.clipboard?.writeText(t.body)}
            className="w-full text-left px-2 py-1.5 text-xs bg-surface border border-divider rounded mb-1 hover:bg-accent/10 hover:border-accent/40 text-fg">
            {t.label}
          </button>
        ))}
        <p className="text-xs text-fg-faint mt-1">Click to copy to clipboard</p>
      </div>
    </div>
  );
}

// ── Compose Panel ──────────────────────────────────────────
function ComposePanel({ replyTo, attachedIds, onSend, onDraft }: {
  replyTo?: EmailMessage;
  attachedIds: string[];
  onSend: (to: string, subject: string, body: string) => void;
  onDraft: (to: string, subject: string, body: string) => void;
}) {
  const { brochures } = useAppStore();
  const [to, setTo] = useState(replyTo ? replyTo.from : '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');

  return (
    <div className="flex flex-col h-full p-4 space-y-2">
      <input className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <input className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="flex-1 text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 120 }} />
      {attachedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attachedIds.map((id) => {
            const b = brochures.find((br) => br.id === id);
            return b ? <span key={id} className="text-xs bg-accent/15 text-accent-light px-2 py-0.5 rounded flex items-center gap-1"><Paperclip size={10} /> {b.name}</span> : null;
          })}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onSend(to, subject, body)} className="flex items-center gap-1 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim">
          <Send size={13} /> Send
        </button>
        <button onClick={() => onDraft(to, subject, body)} className="px-4 py-2 text-sm text-fg-muted rounded-lg hover:bg-surface-1 border border-divider">
          Save Draft
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function EmailPage() {
  const emails = useAppStore((s) => s.emails);
  const drafts = useAppStore((s) => s.drafts);
  const brochures = useAppStore((s) => s.brochures);
  const updateEmail = useAppStore((s) => s.updateEmail);
  const addEmail = useAppStore((s) => s.addEmail);
  const setSelectedEmailId = useAppStore((s) => s.setSelectedEmailId);

  const [folder, setFolder] = useState<Folder>('inbox');
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<EmailMessage | undefined>();
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const folderEmails = [...emails].filter((e) => e.folder === folder).sort((a, b) => b.date.localeCompare(a.date));
  const unread = (f: Folder) => emails.filter((e) => e.folder === f && !e.isRead).length;

  // Lookup the AI draft (if any) for the currently selected email.
  const currentDraft = selected
    ? drafts.find((d) => d.inReplyToEmailId === selected.id && d.status !== 'discarded') ?? null
    : null;

  // Sync selection with the store so voice commands can target it.
  useEffect(() => {
    setSelectedEmailId(selected?.id ?? null);
    return () => setSelectedEmailId(null);
  }, [selected, setSelectedEmailId]);

  function open(email: EmailMessage) {
    setSelected(email); setComposing(false);
    if (!email.isRead) updateEmail(email.id, { isRead: true });
  }

  function reply() {
    if (!selected) return;
    setReplyTo(selected); setAttachedIds([]); setComposing(true);
  }

  function sendEmail(to: string, subject: string, body: string) {
    addEmail({ id: `e-${Date.now()}`, from: 'colton@trinitysurfaces.com', fromName: 'Colton P.', to: [to], subject, body, date: new Date().toISOString(), isRead: true, isStarred: false, folder: 'sent', attachedBrochureIds: attachedIds });
    setComposing(false); setReplyTo(undefined); setAttachedIds([]);
  }

  function saveDraft(to: string, subject: string, body: string) {
    addEmail({ id: `e-${Date.now()}`, from: 'colton@trinitysurfaces.com', fromName: 'Colton P.', to: [to], subject, body, date: new Date().toISOString(), isRead: true, isStarred: false, folder: 'drafts', attachedBrochureIds: attachedIds });
    setComposing(false);
  }

  async function handleGenerateDraft() {
    if (!selected || generatingId) return;
    setGeneratingId(selected.id);
    try {
      await generateDraftForEmail(selected.id);
    } catch (err) {
      console.error('Draft generation failed', err);
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleRegenerateDraft() {
    if (!selected || generatingId) return;
    setGeneratingId(selected.id);
    try {
      await regenerateDraft(selected.id);
    } catch (err) {
      console.error('Regenerate failed', err);
    } finally {
      setGeneratingId(null);
    }
  }

  function handleSendDraft(draftId: string) {
    draftsService.send(draftId);
  }

  function handleDiscardDraft(draftId: string) {
    draftsService.discard(draftId);
  }

  // Mobile pane state — derived from selected/composing. On mobile, only one
  // pane shows at a time. On desktop, all panes are visible side-by-side.
  const mobileShowingReader = selected !== null || composing;

  return (
    <div
      className="flex flex-col md:flex-row rounded-lg border border-divider bg-surface overflow-hidden"
      style={{ height: 'calc(100dvh - 7rem)' }}
    >
      {/* Folder nav — horizontal pills on mobile, vertical column on desktop.
          Hidden on mobile while reading/composing so the reader gets full screen. */}
      <div className={clsx(
        'shrink-0 border-divider flex',
        'md:w-32 md:flex-col md:py-2 md:border-r',
        'flex-row gap-1 px-2 py-2 border-b overflow-x-auto md:overflow-x-visible',
        mobileShowingReader && 'hidden md:flex',
      )}>
        <button
          onClick={() => { setComposing(true); setSelected(null); setReplyTo(undefined); setAttachedIds([]); }}
          className="shrink-0 px-3 md:px-2 py-1.5 md:mx-2 md:mb-2 bg-accent text-white text-xs rounded-lg font-medium hover:bg-accent-dim flex items-center gap-1"
        >
          <Pencil size={11} /> Compose
        </button>
        {FOLDERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFolder(key); setSelected(null); setComposing(false); }}
            className={clsx(
              'shrink-0 flex items-center gap-1.5 px-3 md:px-3 py-1.5 md:py-2 text-sm rounded-lg md:rounded-none',
              folder === key
                ? 'bg-accent/10 text-accent-light font-medium'
                : 'text-fg-muted hover:bg-bg',
            )}
          >
            <span>{label}</span>
            {unread(key) > 0 && <span className="text-xs bg-accent text-white rounded-full px-1.5">{unread(key)}</span>}
          </button>
        ))}
        <div className="hidden md:block flex-1" />
        <button
          onClick={() => setAiOpen((v) => !v)}
          className="hidden md:flex mx-2 mb-2 items-center gap-1 px-2 py-1.5 text-xs text-fg-muted border border-divider rounded-lg hover:bg-bg"
        >
          <Zap size={11} className="text-accent-light" />
          {aiOpen ? 'Hide AI' : 'AI Tools'}
        </button>
      </div>

      {/* Email list — full-width on mobile when not reading; 240px column on desktop. */}
      <div className={clsx(
        'border-divider overflow-y-auto',
        'md:w-60 md:shrink-0 md:border-r md:block',
        mobileShowingReader ? 'hidden md:block' : 'flex-1 md:flex-none',
      )}>
        {folderEmails.length === 0 ? (
          <p className="px-3 py-6 text-xs text-fg-faint text-center">No emails in {folder}.</p>
        ) : folderEmails.map((email) => (
          <button key={email.id} onClick={() => open(email)}
            className={clsx('w-full text-left px-3 py-3 border-b border-divider hover:bg-bg', selected?.id === email.id && 'bg-accent/10')}>
            <div className="flex items-center gap-1">
              {!email.isRead && <span className="w-1.5 h-1.5 bg-accent rounded-full shrink-0" />}
              {email.isStarred && <Star size={10} className="text-warning fill-warning shrink-0" />}
              <span className={clsx('text-xs truncate flex-1', !email.isRead ? 'font-semibold text-fg' : 'text-fg-muted')}>
                {email.folder === 'sent' || email.folder === 'drafts' ? email.to[0] : email.fromName}
              </span>
            </div>
            <p className="text-xs font-medium text-fg truncate mt-0.5">{email.subject}</p>
            <p className="text-xs text-fg-faint">{email.date.slice(0, 10)}</p>
          </button>
        ))}
      </div>

      {/* Read / Compose pane — full-width on mobile when active; hidden when not. */}
      <div className={clsx(
        'flex-1 min-w-0 overflow-hidden flex',
        mobileShowingReader ? 'flex' : 'hidden md:flex',
      )}>
        <div className="flex-1 overflow-y-auto">
          {/* Mobile back row */}
          {mobileShowingReader && (
            <div className="md:hidden flex items-center px-3 py-2 border-b border-divider bg-surface-1">
              <button
                onClick={() => { setSelected(null); setComposing(false); setReplyTo(undefined); }}
                className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
              >
                <ChevronLeft size={16} /> Back to {folder}
              </button>
            </div>
          )}
          {composing ? (
            <ComposePanel replyTo={replyTo} attachedIds={attachedIds} onSend={sendEmail} onDraft={saveDraft} />
          ) : selected ? (
            <div className="flex flex-col">
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-fg">{selected.subject}</h2>
                    <p className="text-xs text-fg-muted mt-1"><strong>From:</strong> {selected.fromName} &lt;{selected.from}&gt;</p>
                    <p className="text-xs text-fg-muted"><strong>To:</strong> {selected.to.join(', ')}</p>
                    <p className="text-xs text-fg-faint">{selected.date.replace('T',' ').slice(0,16)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => updateEmail(selected.id, { isStarred: !selected.isStarred })} className="p-1 rounded hover:bg-surface-1">
                      <Star size={16} className={selected.isStarred ? 'text-warning fill-warning' : 'text-fg-faint'} />
                    </button>
                    <button onClick={reply} className="px-3 py-1.5 text-xs border border-divider rounded-lg hover:bg-bg text-fg-muted">Reply</button>
                  </div>
                </div>
                {selected.attachedBrochureIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 py-2 border-y border-divider">
                    {selected.attachedBrochureIds.map((bid) => {
                      const b = brochures.find((br) => br.id === bid);
                      return b ? <span key={bid} className="flex items-center gap-1 text-xs bg-surface-1 text-fg-muted px-2 py-1 rounded"><Paperclip size={11} /> {b.name}</span> : null;
                    })}
                  </div>
                )}
                <pre className="text-sm text-fg whitespace-pre-wrap font-sans leading-relaxed">{selected.body}</pre>

                {/* New-project banner — only when the AI couldn't confidently match a project */}
                {currentDraft && currentDraft.status === 'pending' && (
                  <NewProjectPrompt
                    draft={currentDraft}
                    email={selected}
                    onResolved={() => { /* draft updates flow through store subscriptions */ }}
                  />
                )}
              </div>

              {/* AI-drafted reply (inbox only — sent/drafts folders have their own flow) */}
              {selected.folder === 'inbox' && (
                <AutoDraftPanel
                  draft={currentDraft}
                  generating={generatingId === selected.id}
                  emailId={selected.id}
                  onGenerate={handleGenerateDraft}
                  onRegenerate={handleRegenerateDraft}
                  onSend={handleSendDraft}
                  onDiscard={handleDiscardDraft}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-fg-faint text-center mt-16">Select an email to read</p>
          )}
        </div>

        {/* AI Tools — desktop only. On mobile the global voice button +
            AutoDraftPanel cover the same functions (product lookup,
            brochure attach, quick quote, templates). */}
        {aiOpen && (
          <div className="hidden md:block">
            <AIToolsPanel onAttach={(id) => setAttachedIds((prev) => prev.includes(id) ? prev : [...prev, id])} />
          </div>
        )}
      </div>
    </div>
  );
}
