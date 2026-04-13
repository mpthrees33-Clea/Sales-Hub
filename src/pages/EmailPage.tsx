import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Star, Paperclip } from 'lucide-react';
import type { EmailMessage } from '../types';
import clsx from 'clsx';

type Folder = 'inbox' | 'sent' | 'drafts' | 'trash';

const FOLDERS: { key: Folder; label: string }[] = [
  { key: 'inbox',  label: 'Inbox'  },
  { key: 'sent',   label: 'Sent'   },
  { key: 'drafts', label: 'Drafts' },
  { key: 'trash',  label: 'Trash'  },
];

export default function EmailPage() {
  const { emails, updateEmail, brochures } = useAppStore();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [selected, setSelected] = useState<EmailMessage | null>(null);

  const folderEmails = emails
    .filter((e) => e.folder === folder)
    .sort((a, b) => b.date.localeCompare(a.date));

  const unreadCount = (f: Folder) => emails.filter((e) => e.folder === f && !e.isRead).length;

  function open(email: EmailMessage) {
    setSelected(email);
    if (!email.isRead) updateEmail(email.id, { isRead: true });
  }

  return (
    <div className="flex h-full gap-0 bg-white rounded-lg border border-slate-200 overflow-hidden" style={{ minHeight: '60vh' }}>
      {/* Folder sidebar */}
      <div className="w-32 shrink-0 border-r border-slate-100 py-2">
        {FOLDERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFolder(key); setSelected(null); }}
            className={clsx(
              'w-full text-left px-3 py-2 text-sm flex justify-between items-center',
              folder === key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <span>{label}</span>
            {unreadCount(key) > 0 && (
              <span className="text-xs bg-blue-600 text-white rounded-full px-1.5">{unreadCount(key)}</span>
            )}
          </button>
        ))}
      </div>

      {/* Email list */}
      <div className="w-64 shrink-0 border-r border-slate-100 overflow-y-auto">
        {folderEmails.length === 0 && (
          <p className="text-xs text-slate-400 p-4 text-center">No emails</p>
        )}
        {folderEmails.map((email) => (
          <button
            key={email.id}
            onClick={() => open(email)}
            className={clsx(
              'w-full text-left px-3 py-3 border-b border-slate-50 hover:bg-slate-50',
              selected?.id === email.id && 'bg-blue-50',
              !email.isRead && 'bg-white'
            )}
          >
            <div className="flex items-center gap-1">
              {!email.isRead && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0" />}
              {email.isStarred && <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />}
              <span className={clsx('text-xs truncate flex-1', !email.isRead ? 'font-semibold text-slate-800' : 'text-slate-600')}>
                {email.folder === 'sent' || email.folder === 'drafts' ? email.to[0] : email.fromName}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-700 truncate mt-0.5">{email.subject}</p>
            <p className="text-xs text-slate-400 truncate">{email.body.slice(0, 60)}</p>
            <p className="text-xs text-slate-300 mt-1">{email.date.slice(0, 10)}</p>
          </button>
        ))}
      </div>

      {/* Email body */}
      <div className="flex-1 overflow-y-auto p-5">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800 text-base">{selected.subject}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  <strong>From:</strong> {selected.fromName} &lt;{selected.from}&gt;
                </p>
                <p className="text-xs text-slate-500">
                  <strong>To:</strong> {selected.to.join(', ')}
                </p>
                <p className="text-xs text-slate-400">{selected.date.replace('T', ' ').slice(0, 16)}</p>
              </div>
              <button
                onClick={() => updateEmail(selected.id, { isStarred: !selected.isStarred })}
                className="p-1 rounded hover:bg-slate-100"
              >
                <Star size={16} className={selected.isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'} />
              </button>
            </div>

            {selected.attachedBrochureIds.length > 0 && (
              <div className="flex flex-wrap gap-2 py-2 border-y border-slate-100">
                {selected.attachedBrochureIds.map((bid) => {
                  const b = brochures.find((br) => br.id === bid);
                  return b ? (
                    <span key={bid} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      <Paperclip size={11} /> {b.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
              {selected.body}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center mt-16">Select an email to read</p>
        )}
      </div>
    </div>
  );
}
