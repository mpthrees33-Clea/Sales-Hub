"use server";

/**
 * CRM edit actions (WO — CRM module). Light, human-only edits: opportunity
 * stage/value/next-step and contact details. Each requires a session, records
 * an audit row, and (for opportunities) writes an activity so the CRM timeline
 * and the dashboard's overnight-changes feed reflect the change — mirroring the
 * approval executor's opportunity path (src/lib/approvals/execute.ts).
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, contacts, opportunities } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { getDemoNow } from "@/lib/demo-clock";
import { STAGE_ORDER, type Stage } from "@/lib/crm-stages";

export async function updateOpportunity(input: {
  id: string;
  stage?: Stage;
  valueCents?: number;
  nextStep?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await requireSession();
  const existing = await db.query.opportunities.findFirst({ where: eq(opportunities.id, input.id) });
  if (!existing) return { ok: false, error: "opportunity not found" };
  const demoNow = await getDemoNow();

  const diffs: { field: string; old: unknown; new: unknown }[] = [];
  const patch: Record<string, unknown> = {};

  if (input.stage && input.stage !== existing.stage && STAGE_ORDER.includes(input.stage)) {
    diffs.push({ field: "stage", old: existing.stage, new: input.stage });
    patch.stage = input.stage;
  }
  if (typeof input.valueCents === "number" && Number.isFinite(input.valueCents) && input.valueCents >= 0) {
    const v = Math.round(input.valueCents);
    if (v !== existing.valueCents) {
      diffs.push({ field: "value_cents", old: existing.valueCents, new: v });
      patch.valueCents = v;
    }
  }
  if (input.nextStep !== undefined) {
    const v = input.nextStep.trim() || null;
    if (v !== existing.nextStep) {
      diffs.push({ field: "next_step", old: existing.nextStep, new: v });
      patch.nextStep = v;
    }
  }

  if (diffs.length === 0) return { ok: true };

  patch.lastActivityAt = demoNow;
  await db.update(opportunities).set(patch).where(eq(opportunities.id, input.id));
  await db.insert(activities).values({
    type: "note",
    accountId: existing.accountId,
    opportunityId: existing.id,
    refType: "crm",
    summary: `Opportunity updated (${diffs.map((d) => d.field).join(", ")})`,
    detail: { diffs },
    occurredAt: demoNow,
  });
  await audit({
    actor: `user:${userId}`,
    action: "opportunity.updated",
    objectType: "opportunity",
    objectId: input.id,
    detail: { diffs },
  });

  revalidatePath(`/crm/${existing.accountId}`);
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateContact(input: {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await requireSession();
  const existing = await db.query.contacts.findFirst({ where: eq(contacts.id, input.id) });
  if (!existing) return { ok: false, error: "contact not found" };

  const name = input.name?.trim();
  const email = input.email?.trim();
  if (name !== undefined && !name) return { ok: false, error: "name required" };
  if (email !== undefined && !email) return { ok: false, error: "email required" };

  const patch: Record<string, unknown> = {};
  if (name !== undefined && name !== existing.name) patch.name = name;
  if (email !== undefined && email !== existing.email) patch.email = email;
  if (input.phone !== undefined) {
    const v = input.phone.trim() || null;
    if (v !== existing.phone) patch.phone = v;
  }
  if (input.role !== undefined) {
    const v = input.role.trim() || null;
    if (v !== existing.role) patch.role = v;
  }

  if (Object.keys(patch).length === 0) return { ok: true };
  await db.update(contacts).set(patch).where(eq(contacts.id, input.id));
  await audit({
    actor: `user:${userId}`,
    action: "contact.updated",
    objectType: "contact",
    objectId: input.id,
    detail: { fields: Object.keys(patch) },
  });
  revalidatePath(`/crm/${existing.accountId}`);
  return { ok: true };
}
