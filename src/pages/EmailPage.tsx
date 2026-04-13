import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Star, Paperclip, ChevronRight, ChevronLeft, Send, FileText, Search, Calculator, Zap } from 'lucide-react';
import type { EmailMessage } from '../types';
import clsx from 'clsx';

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
    <div className="w-64 border-l border-slate-100 flex flex-col overflow-y-auto bg-slate-50">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-1.5">
        <Zap size={14} className="text-blue-500" />
        <span className="text-xs font-semibold text-slate-700">AI Tools</span>
      </div>

      {/* Product Lookup */}
      <div className="px-3 py-3 border-b border-slate-100">
        <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1"><Search size={11} /> Product Lookup</p>
        <input className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          placeholder="Any name or brand…" value={lookup} onChange={(e) => setLookup(e.target.value)} />
        {lookupResults.map((p) => (
          <div key={p.id} className="mt-1.5 bg-white border border-slate-200 rounded p-2 text-xs">
            <p className="font-medium text-slate-700">{p.trinityName}</p>
            <p className="text-slate-400">{p.category} · ${p.listPrice}/{p.unit}</p>
            <p className="text-slate-400 truncate">{p.privateLabels.map((pl) => pl.brand).join(', ')}</p>
          </div>
        ))}
      </div>

      {/* Attach Brochure */}
      <div className="px-3 py-3 border-b border-slate-100">
        <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1"><Paperclip size={11} /> Attach Brochure</p>
        <input className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          placeholder="Search brochures…" value={brochureSearch} onChange={(e) => setBrochureSearch(e.target.value)} />
        {filteredBrochures.map((b) => (
          <button key={b.id} onClick={() => { onAttach(b.id); setBrochureSearch(''); }}
            className="w-full text-left mt-1 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded hover:bg-blue-50 hover:border-blue-300 truncate text-slate-700">
            + {b.name}
          </button>
        ))}
      </div>

      {/* Quick Quote */}
      <div className="px-3 py-3 border-b border-slate-100">
        <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1"><Calculator size={11} /> Quick Quote</p>
        <select className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          value={quoteProduct} onChange={(e) => setQuoteProduct(e.target.value)}>
          <option value="">Select product…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.trinityName}</option>)}
        </select>
        <input type="number" className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          placeholder="Square footage" value={sqft} onChange={(e) => setSqft(e.target.value)} />
        {quoteResult && (
          <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded p-2 text-xs">
            <p className="text-blue-700 font-medium">{quoteResult.sqft} sq ft (w/ 10% waste)</p>
            <p className="text-blue-800 font-bold">${quoteResult.total} list</p>
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="px-3 py-3">
        <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1"><FileText size={11} /> Templates</p>
        {TEMPLATES.map((t) => (
          <button key={t.keyword} onClick={() => navigator.clipboard?.writeText(t.body)}
            className="w-full text-left px-2 py-1.5 text-xs bg-white border border-slate-200 rounded mb-1 hover:bg-blue-50 hover:border-blue-300 text-slate-700">
            {t.label}
          </button>
        ))}
        <p className="text-xs text-slate-400 mt-1">Click to copy to clipboard</p>
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
      <input className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <input className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 120 }} />
      {attachedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attachedIds.map((id) => {
            const b = brochures.find((br) => br.id === id);
            return b ? <span key={id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1"><Paperclip size={10} /> {b.name}</span> : null;
          })}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onSend(to, subject, body)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Send size={13} /> Send
        </button>
        <button onClick={() => onDraft(to, subject, body)} className="px-4 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-100 border border-slate-200">
          Save Draft
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function EmailPage() {
  const { emails, updateEmail, addEmail, brochures } = useAppStore();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<EmailMessage | undefined>();
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(true);

  const folderEmails = [...emails].filter((e) => e.folder === folder).sort((a, b) => b.date.localeCompare(a.date));
  const unread = (f: Folder) => emails.filter((e) => e.folder === f && !e.isRead).length;

  function open(email: EmailMessage) {
    setSelected(email); setComposing(false);
    if (!email.isRead) updateEmail(email.id, { isRead: true });
  }

  function reply() {
    if (!selected) return;
    setReplyTo(selected); setAttachedIds([]); setComposing(true);
  }

  function sendEmail(to: string, subject: string, body: string) {
    addEmail({ id: `e-${Date.now()}`, from: 'sarah@trinitysurfaces.com', fromName: 'Sarah T.', to: [to], subject, body, date: new Date().toISOString(), isRead: true, isStarred: false, folder: 'sent', attachedBrochureIds: attachedIds });
    setComposing(false); setReplyTo(undefined); setAttachedIds([]);
  }

  function saveDraft(to: string, subject: string, body: string) {
    addEmail({ id: `e-${Date.now()}`, from: 'sarah@trinitysurfaces.com', fromName: 'Sarah T.', to: [to], subject, body, date: new Date().toISOString(), isRead: true, isStarred: false, folder: 'drafts', attachedBrochureIds: attachedIds });
    setComposing(false);
  }

  return (
    <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden" style={{ height: '75vh' }}>
      {/* Folder nav */}
      <div className="w-32 shrink-0 border-r border-slate-100 flex flex-col py-2">
        <button onClick={() => { setComposing(true); setReplyTo(undefined); setAttachedIds([]); }}
          className="mx-2 mb-2 px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700">
          + Compose
        </button>
        {FOLDERS.map(({ key, label }) => (
          <button key={key} onClick={() => { setFolder(key); setSelected(null); setComposing(false); }}
            className={clsx('flex justify-between items-center px-3 py-2 text-sm', folder === key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50')}>
            <span>{label}</span>
            {unread(key) > 0 && <span className="text-xs bg-blue-600 text-white rounded-full px-1.5">{unread(key)}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setAiOpen((v) => !v)}
          className="mx-2 mb-2 flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Zap size={11} className="text-blue-400" />
          {aiOpen ? 'Hide AI' : 'AI Tools'}
        </button>
      </div>

      {/* Email list */}
      <div className="w-60 shrink-0 border-r border-slate-100 overflow-y-auto">
        {folderEmails.map((email) => (
          <button key={email.id} onClick={() => open(email)}
            className={clsx('w-full text-left px-3 py-3 border-b border-slate-50 hover:bg-slate-50', selected?.id === email.id && 'bg-blue-50')}>
            <div className="flex items-center gap-1">
              {!email.isRead && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0" />}
              {email.isStarred && <Star size={10} className="text-yellow-400 fill-yellow-400 shrink-0" />}
              <span className={clsx('text-xs truncate flex-1', !email.isRead ? 'font-semibold text-slate-800' : 'text-slate-600')}>
                {email.folder === 'sent' || email.folder === 'drafts' ? email.to[0] : email.fromName}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-700 truncate mt-0.5">{email.subject}</p>
            <p className="text-xs text-slate-400">{email.date.slice(0, 10)}</p>
          </button>
        ))}
      </div>

      {/* Read / Compose pane */}
      <div className="flex-1 min-w-0 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto">
          {composing ? (
            <ComposePanel replyTo={replyTo} attachedIds={attachedIds} onSend={sendEmail} onDraft={saveDraft} />
          ) : selected ? (
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-800">{selected.subject}</h2>
                  <p className="text-xs text-slate-500 mt-1"><strong>From:</strong> {selected.fromName} &lt;{selected.from}&gt;</p>
                  <p className="text-xs text-slate-500"><strong>To:</strong> {selected.to.join(', ')}</p>
                  <p className="text-xs text-slate-400">{selected.date.replace('T',' ').slice(0,16)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => updateEmail(selected.id, { isStarred: !selected.isStarred })} className="p-1 rounded hover:bg-slate-100">
                    <Star size={16} className={selected.isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'} />
                  </button>
                  <button onClick={reply} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">Reply</button>
                </div>
              </div>
              {selected.attachedBrochureIds.length > 0 && (
                <div className="flex flex-wrap gap-2 py-2 border-y border-slate-100">
                  {selected.attachedBrochureIds.map((bid) => {
                    const b = brochures.find((br) => br.id === bid);
                    return b ? <span key={bid} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded"><Paperclip size={11} /> {b.name}</span> : null;
                  })}
                </div>
              )}
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{selected.body}</pre>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center mt-16">Select an email to read</p>
          )}
        </div>

        {/* AI Tools */}
        {aiOpen && <AIToolsPanel onAttach={(id) => setAttachedIds((prev) => prev.includes(id) ? prev : [...prev, id])} />}
      </div>
    </div>
  );
}
