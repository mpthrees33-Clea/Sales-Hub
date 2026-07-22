import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity as ActivityIcon, ArrowLeft, Building2, Mic, Target, Users } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { accountDetail } from "@/lib/queries/crm";
import { type Stage } from "@/lib/crm-stages";
import { formatCents } from "@/lib/money";
import { formatDateShort, formatDateTime, relativeAge } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { OpportunityRow } from "../_components/opportunity-row";
import { ContactRow } from "../_components/contact-row";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await accountDetail(id);
  if (!data) notFound();
  const demoNow = await getDemoNow();
  const { account, contacts, opportunities, activities, quotes, salesOrders, sampleOrders, meetings, projects } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/crm" className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> CRM
      </Link>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">{account.name}</h1>
        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
          {account.type} · {account.address.city}, {account.address.state} · {account.tier} tier · credit{" "}
          {formatCents(account.creditLimitCents, { compact: true })}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader n="01" title="Contacts" right={<span className="font-mono text-[10px] text-ink-faint">{contacts.length}</span>} />
            {contacts.length === 0 ? (
              <EmptyState icon={Users} title="No contacts" copy="No contacts on this account yet." />
            ) : (
              <ul className="divide-y divide-line">
                {contacts.map((c) => (
                  <ContactRow key={c.id} contact={{ id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.role }} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader n="02" title="Projects" />
            {projects.length === 0 ? (
              <EmptyState icon={Building2} title="No projects" copy="No projects linked to this account." />
            ) : (
              <ul className="divide-y divide-line">
                {projects.map((p) => (
                  <li key={p.id} className="px-4 py-2.5">
                    <p className="text-[12px]">{p.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                      {p.segment.replace("_", " ")}
                      {p.stage ? ` · ${p.stage}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader n="03" title="Opportunities" right={<span className="font-mono text-[10px] text-ink-faint">{opportunities.length}</span>} />
            {opportunities.length === 0 ? (
              <EmptyState icon={Target} title="No opportunities" copy="Nothing in the pipeline for this account." />
            ) : (
              <ul className="divide-y divide-line">
                {opportunities.map((o) => (
                  <OpportunityRow
                    key={o.id}
                    opp={{ id: o.id, name: o.name, stage: o.stage as Stage, valueCents: o.valueCents, probability: o.probability, nextStep: o.nextStep }}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader n="04" title="Activity" />
            {activities.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No activity" copy="No recorded activity yet." />
            ) : (
              <ul className="divide-y divide-line">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px]">{a.summary}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{a.type}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint" title={formatDateTime(a.occurredAt)}>
                      {relativeAge(a.occurredAt, demoNow)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <RelatedCard
              n="05"
              title="Quotes"
              items={quotes.map((qr) => ({ id: qr.id, main: qr.number, sub: formatCents(qr.totalCents, { compact: true }), status: qr.status }))}
            />
            <RelatedCard
              n="06"
              title="Sales orders"
              items={salesOrders.map((s) => ({ id: s.id, main: s.number, sub: formatCents(s.totalCents, { compact: true }), status: s.status }))}
            />
            <RelatedCard
              n="07"
              title="Samples"
              items={sampleOrders.map((s) => ({
                id: s.id,
                main: `${s.items.length} item${s.items.length !== 1 ? "s" : ""}`,
                sub: s.orderedAt ? formatDateShort(s.orderedAt) : "—",
                status: s.status,
              }))}
            />
          </div>

          <Card>
            <CardHeader n="08" title="Meetings" />
            {meetings.length === 0 ? (
              <EmptyState icon={Mic} title="No meetings" copy="No meetings on record for this account." />
            ) : (
              <ul className="divide-y divide-line">
                {meetings.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px]">{m.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{m.status}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">{formatDateShort(m.startsAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RelatedCard({
  n,
  title,
  items,
}: {
  n: string;
  title: string;
  items: { id: string; main: string; sub: string; status: string }[];
}) {
  return (
    <Card>
      <CardHeader n={n} title={title} />
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center font-mono text-[10px] text-ink-faint">none</div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[11px]">{it.main}</span>
                <span className="font-mono text-[10px] text-ink-faint">{it.sub}</span>
              </div>
              <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{it.status}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
