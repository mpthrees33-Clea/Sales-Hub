"use client";

/** Compose-with-AI dialog (WO-04 task 9) — approval-gated outbound draft. */
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";

export type ContactOption = { email: string; name: string; accountId: string };

export function ComposeDialog({
  contacts,
  busy,
  onSubmit,
  onClose,
}: {
  contacts: ContactOption[];
  busy: boolean;
  onSubmit: (input: { to: string[]; subject: string; intent: string; accountId?: string }) => void;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [intent, setIntent] = useState("");

  const match = contacts.find((c) => c.email === to.trim());
  const canSend = to.trim().length > 0 && intent.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Compose with AI">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-lg border border-line bg-surface p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium">Compose with AI</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface2 hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <input
            list="compose-contacts"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Recipient (seeded contact email)"
            className="w-full rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] outline-none"
          />
          <datalist id="compose-contacts">
            {contacts.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name}
              </option>
            ))}
          </datalist>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] outline-none"
          />
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="One line: what do you want to say?"
            className="min-h-[90px] w-full resize-y rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] outline-none"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="primary"
            disabled={!canSend || busy}
            onClick={() => onSubmit({ to: [to.trim()], subject: subject.trim() || "Following up", intent: intent.trim(), accountId: match?.accountId })}
          >
            Draft with AI
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <span className="ml-auto font-mono text-[10px] text-ink-faint">Drafts only — humans send</span>
        </div>
      </div>
    </div>
  );
}
