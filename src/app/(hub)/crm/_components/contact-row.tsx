"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { updateContact } from "../actions";

type Contact = { id: string; name: string; email: string; phone: string | null; role: string | null };

export function ContactRow({ contact }: { contact: Contact }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [role, setRole] = useState(contact.role ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateContact({ id: contact.id, name, email, phone, role });
      if (res.ok) setEditing(false);
      else setErr(res.error);
    });
  }

  if (!editing) {
    return (
      <li className="flex items-start justify-between gap-2 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[12px] font-medium">
            {contact.name}
            {contact.role ? <span className="ml-1.5 font-mono text-[10px] text-ink-faint">{contact.role}</span> : null}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">
            {contact.email}
            {contact.phone ? ` · ${contact.phone}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit contact"
          className="shrink-0 rounded-md p-1 text-ink-faint hover:bg-surface2 hover:text-ink"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </li>
    );
  }

  return (
    <li className="space-y-1.5 bg-surface2/40 px-4 py-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="name"
        aria-label="Name"
        className="w-full rounded border border-line bg-surface px-1.5 py-1 text-[12px] outline-none focus:border-accent"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        aria-label="Email"
        className="w-full rounded border border-line bg-surface px-1.5 py-1 font-mono text-[11px] outline-none focus:border-accent"
      />
      <div className="flex gap-1.5">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="phone"
          aria-label="Phone"
          className="w-full rounded border border-line bg-surface px-1.5 py-1 font-mono text-[11px] outline-none focus:border-accent"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="role"
          aria-label="Role"
          className="w-full rounded border border-line bg-surface px-1.5 py-1 text-[11px] outline-none focus:border-accent"
        />
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={save} disabled={pending} aria-label="Save" className="rounded-md p-1 text-ok hover:bg-surface2 disabled:opacity-50">
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setErr(null);
          }}
          aria-label="Cancel"
          className="rounded-md p-1 text-ink-faint hover:bg-surface2"
        >
          <X className="h-4 w-4" />
        </button>
        {err ? <span className="font-mono text-[10px] text-danger">{err}</span> : null}
      </div>
    </li>
  );
}
