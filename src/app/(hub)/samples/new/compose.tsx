"use client";

/** Manual sample-order compose form (WO-09). Rep orders still ride the approval rail. */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui";
import { SAMPLE_SIZES } from "@/db/schema";
import { createManualSampleOrder } from "../actions";

type Contact = { id: string; name: string; accountId: string; accountName: string };
type Product = { id: string; sku: string; name: string };
type Line = { productId: string; sku: string; name: string; size: (typeof SAMPLE_SIZES)[number]; qty: number };

export function ComposeSample({ contacts, catalog, prefillSku }: { contacts: Contact[]; catalog: Product[]; prefillSku: string | null }) {
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? "");
  const [pick, setPick] = useState("");
  const prefill = prefillSku ? catalog.find((c) => c.sku === prefillSku) : null;
  const [lines, setLines] = useState<Line[]>(prefill ? [{ productId: prefill.id, sku: prefill.sku, name: prefill.name, size: "8x10", qty: 1 }] : []);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const contact = useMemo(() => contacts.find((c) => c.id === contactId), [contacts, contactId]);

  const addLine = () => {
    const p = catalog.find((c) => c.sku === pick || c.name === pick || c.id === pick);
    if (p && !lines.some((l) => l.productId === p.id)) setLines([...lines, { productId: p.id, sku: p.sku, name: p.name, size: "8x10", qty: 1 }]);
    setPick("");
  };
  const submit = () => {
    if (!contact || lines.length === 0) return;
    startTransition(async () => {
      const r = await createManualSampleOrder({ accountId: contact.accountId, contactId: contact.id, items: lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })) });
      setDone(r.approvalId);
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/samples" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> samples</Link>
        <h1 className="text-lg font-semibold tracking-tight">New sample order</h1>
      </div>

      {done ? (
        <Card className="p-4 text-center">
          <p className="text-[13px] font-medium">Sample order queued for approval</p>
          <p className="mt-1 text-[11px] text-ink-muted">Rep orders still ride the approval rail — one keystroke to approve.</p>
          <Link href={`/approvals?id=${done}`} className="mt-3 inline-block font-mono text-[11px] text-accent hover:underline">Review in Approvals →</Link>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Details" />
          <div className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">Contact</span>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full rounded border border-line bg-surface2 px-2 py-1.5 text-[13px]">
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.accountName}</option>)}
              </select>
            </label>

            <div>
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">Products</span>
              <div className="flex gap-1.5">
                <input list="sample-catalog" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="SKU or name" className="min-w-0 flex-1 rounded border border-line bg-surface2 px-2 py-1.5 text-[13px] outline-none" />
                <datalist id="sample-catalog">{catalog.map((c) => <option key={c.id} value={c.sku}>{c.name}</option>)}</datalist>
                <Button variant="default" onClick={addLine}><Plus className="h-3.5 w-3.5" /> add</Button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {lines.map((l, i) => (
                  <li key={l.productId} className="flex items-center gap-2 rounded border border-line px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[12px]">{l.name} <span className="font-mono text-[10px] text-ink-faint">{l.sku}</span></span>
                    <select value={l.size} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, size: e.target.value as Line["size"] } : x))} className="rounded border border-line bg-surface2 px-1 py-0.5 text-[11px]">
                      {SAMPLE_SIZES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                    <input type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value, 10) || 1) } : x))} className="w-12 rounded border border-line bg-surface2 px-1 py-0.5 text-right text-[11px]" />
                    <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-ink-faint hover:text-danger"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 font-mono text-[10px] text-ink-faint">Default 8×10 — a 2-inch chip misrepresents a wall.</p>
            </div>

            <div className="flex items-center gap-2 border-t border-line pt-3">
              <Button variant="primary" disabled={pending || !contact || lines.length === 0} onClick={submit}>Create order</Button>
              <span className="font-mono text-[10px] text-ink-faint">ships to {contact?.accountName} on file · Drafts only — humans send</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
