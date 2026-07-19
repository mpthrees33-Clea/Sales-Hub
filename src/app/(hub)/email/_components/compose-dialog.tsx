"use client";

/** Compose with AI (WO-04 task 9) — approval-gated outbound. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PenLine, X } from "lucide-react";
import { Button } from "@/components/ui";
import { StreamProgress, useAgentStream } from "./thread-actions";

export function ComposeDialog({ contacts }: { contacts: { name: string; email: string; account: string }[] }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [intent, setIntent] = useState("");
  const [query, setQuery] = useState("");
  const { state, run } = useAgentStream();
  const router = useRouter();

  const matches = query.length > 0 ? contacts.filter((c) => (c.name + c.email + c.account).toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];

  const submit = async () => {
    await run("email-reply", { mode: "compose", to: [to], subject: subject || undefined, intent });
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PenLine className="h-3.5 w-3.5" /> Compose with AI
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-md p-1 hover:bg-surface2">
              <X className="h-4 w-4 text-ink-muted" />
            </button>
            <h3 className="text-sm font-semibold">Compose with AI</h3>
            <p className="mt-0.5 font-mono text-[10px] text-ink-faint">Drafts only — humans send</p>
            <div className="mt-3 space-y-2.5">
              <div className="relative">
                <input
                  placeholder="Recipient (search seeded contacts)"
                  value={to || query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setTo("");
                  }}
                  className="w-full rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent"
                />
                {matches.length > 0 && !to ? (
                  <div className="absolute top-full z-30 mt-1 w-full rounded-md border border-line bg-surface shadow-xl">
                    {matches.map((c) => (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => {
                          setTo(c.email);
                          setQuery("");
                        }}
                        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12px] hover:bg-surface2"
                      >
                        <span>
                          {c.name} <span className="text-ink-faint">· {c.account}</span>
                        </span>
                        <span className="font-mono text-[10px] text-ink-faint">{c.email}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                placeholder="Subject (optional)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent"
              />
              <textarea
                placeholder="One-line intent — e.g. 'Follow up on the corridor quote and offer to hold pricing through April.'"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="min-h-[80px] w-full rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent"
              />
              <Button variant="primary" onClick={submit} disabled={!to || !intent || state.phase === "running"} className="w-full">
                Draft it
              </Button>
              <StreamProgress state={state} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
