"use client";

/**
 * Manual sample compose (WO-09 task 3) — under a minute of clicks:
 * multi-select SKUs (swatch thumbs), per-line size (default 8×10) + qty,
 * contact typeahead grouped by account, editable ship-to prefilled from the
 * account address. Still rides the approval rail.
 */
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button, Card, CardHeader, Mono } from "@/components/ui";
import { createManualSampleOrder } from "../actions";

type ProductOpt = { id: string; sku: string; name: string; swatch: string | null };
type ContactOpt = { id: string; name: string; account: string; address: { line1: string; city: string; state: string; zip: string } };
type Line = { productId: string; sku: string; name: string; size: "chip" | "8x10" | "full_sheet"; qty: number };

export function SampleComposeClient({
  products,
  contacts,
  preselectedProductId,
}: {
  products: ProductOpt[];
  contacts: ContactOpt[];
  preselectedProductId?: string;
}) {
  const pre = products.find((p) => p.id === preselectedProductId);
  const [lines, setLines] = useState<Line[]>(
    pre ? [{ productId: pre.id, sku: pre.sku, name: pre.name, size: "8x10", qty: 1 }] : [],
  );
  const [productQuery, setProductQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contact, setContact] = useState<ContactOpt | null>(null);
  const [shipTo, setShipTo] = useState({ line1: "", city: "", state: "", zip: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; approvalId?: string; error?: string } | null>(null);

  const productMatches = useMemo(
    () =>
      productQuery.length > 0
        ? products.filter((p) => (p.sku + p.name).toLowerCase().includes(productQuery.toLowerCase())).slice(0, 6)
        : [],
    [productQuery, products],
  );
  const contactMatches = useMemo(
    () =>
      contactQuery.length > 0
        ? contacts.filter((c) => (c.name + c.account).toLowerCase().includes(contactQuery.toLowerCase())).slice(0, 6)
        : [],
    [contactQuery, contacts],
  );

  const submit = async () => {
    if (!contact || lines.length === 0) return;
    setBusy(true);
    const res = await createManualSampleOrder({
      contactId: contact.id,
      items: lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty, sku: l.sku, name: l.name })),
      shipTo,
    });
    setResult(res);
    setBusy(false);
  };

  if (result?.ok) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <Check className="mx-auto h-6 w-6 text-ok" />
        <p className="mt-2 text-sm font-medium">Sample order queued for approval</p>
        <p className="mt-1 text-[12px] text-ink-muted">
          One keystroke to approve — rep-initiated orders ride the same rail for a uniform audit trail.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/approvals?id=${result.approvalId}`} className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink">
            Review &amp; approve →
          </Link>
          <Link href="/samples" className="rounded-md border border-line px-3 py-1.5 text-[13px]">
            Back to samples
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/samples" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-ink-muted" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">New sample order</h1>
      </div>

      <Card>
        <CardHeader n="01" title="Products" />
        <div className="space-y-2 p-4">
          {lines.map((l, i) => (
            <div key={l.productId} className="flex items-center gap-2 rounded-md border border-line bg-bg p-2">
              <Mono className="w-28 text-[11px]">{l.sku}</Mono>
              <span className="min-w-0 flex-1 truncate text-[13px]">{l.name}</span>
              <select
                value={l.size}
                onChange={(e) => setLines((ls) => ls.map((x, xi) => (xi === i ? { ...x, size: e.target.value as Line["size"] } : x)))}
                className="rounded border border-line bg-surface px-1.5 py-1 font-mono text-[11px]"
                title="Default 8×10 — a 2-inch chip misrepresents a wall."
              >
                <option value="chip">chip</option>
                <option value="8x10">8×10</option>
                <option value="full_sheet">full sheet</option>
              </select>
              <input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => setLines((ls) => ls.map((x, xi) => (xi === i ? { ...x, qty: parseInt(e.target.value || "1", 10) } : x)))}
                className="w-14 rounded border border-line bg-surface px-1.5 py-1 text-right font-mono text-[11px]"
              />
              <button type="button" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, xi) => xi !== i))}>
                <X className="h-3.5 w-3.5 text-ink-faint hover:text-danger" />
              </button>
            </div>
          ))}
          <div className="relative">
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Add a product — search SKU or name…"
              className="w-full rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent"
            />
            {productMatches.length > 0 ? (
              <div className="absolute top-full z-30 mt-1 w-full rounded-md border border-line bg-surface shadow-xl">
                {productMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (!lines.some((l) => l.productId === p.id)) {
                        setLines((ls) => [...ls, { productId: p.id, sku: p.sku, name: p.name, size: "8x10", qty: 1 }]);
                      }
                      setProductQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-surface2"
                  >
                    {p.swatch ? (
                      <Image src={p.swatch} alt="" width={20} height={20} unoptimized className="h-5 w-5 rounded border border-line object-cover" />
                    ) : null}
                    <Mono className="text-[10px] text-ink-faint">{p.sku}</Mono> {p.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <p className="text-[10px] text-ink-faint">Default 8×10 — a 2-inch chip misrepresents a wall.</p>
        </div>
      </Card>

      <Card>
        <CardHeader n="02" title="Ship to" />
        <div className="space-y-2 p-4">
          <div className="relative">
            <input
              value={contact ? `${contact.name} · ${contact.account}` : contactQuery}
              onChange={(e) => {
                setContactQuery(e.target.value);
                setContact(null);
              }}
              placeholder="Contact — search seeded contacts…"
              className="w-full rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent"
            />
            {contactMatches.length > 0 && !contact ? (
              <div className="absolute top-full z-30 mt-1 w-full rounded-md border border-line bg-surface shadow-xl">
                {contactMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setContact(c);
                      setShipTo(c.address);
                      setContactQuery("");
                    }}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12px] hover:bg-surface2"
                  >
                    <span>{c.name}</span>
                    <span className="font-mono text-[10px] text-ink-faint">{c.account}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={shipTo.line1} onChange={(e) => setShipTo({ ...shipTo, line1: e.target.value })} placeholder="Address" className="col-span-2 rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent" />
            <input value={shipTo.city} onChange={(e) => setShipTo({ ...shipTo, city: e.target.value })} placeholder="City" className="rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent" />
            <div className="grid grid-cols-2 gap-2">
              <input value={shipTo.state} onChange={(e) => setShipTo({ ...shipTo, state: e.target.value })} placeholder="ST" className="rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent" />
              <input value={shipTo.zip} onChange={(e) => setShipTo({ ...shipTo, zip: e.target.value })} placeholder="ZIP" className="rounded-md border border-line bg-bg px-2.5 py-2 text-[13px] outline-none focus:border-accent" />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => void submit()} disabled={busy || !contact || lines.length === 0}>
          {busy ? "Queuing…" : "Queue for approval"}
        </Button>
        {result?.error ? <span className="text-[11px] text-danger">{result.error}</span> : null}
        <span className="font-mono text-[10px] text-ink-faint">Drafts only — humans send.</span>
      </div>
    </div>
  );
}
