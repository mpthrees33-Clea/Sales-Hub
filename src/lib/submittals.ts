/**
 * Submittal packages (WO-14): the LLM proposes composition; pdf-lib assembles;
 * page numbers and ordering are code. The routed path deliberately does NOT
 * auto-assemble — `runSubmittalFromRouting` prepares a draft builder session
 * (project + products prefilled from the request email) because picking
 * products and reviewing composition is where human judgment lives; the
 * nightly run surfaces the prepared session instead of a finished package.
 */
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  activities,
  approvals,
  emails,
  pdsDocuments,
  products,
  projects,
  submittalPackages,
  type SubmittalSection,
} from "@/db/schema";
import { audit, type AuditActor } from "@/lib/audit";
import { putBlob } from "@/lib/blob";
import { getDemoNow } from "@/lib/demo-clock";
import { claimRoutingById, completeRouting } from "@/lib/routing";
import { assembleSubmittalPdf } from "@/lib/submittal-assembler";
import { getErpProvider } from "@/providers";

/**
 * Section doc-kind requirements (task 1, config const): `pds` + `install`
 * are REQUIRED for every product; `test_report` + `warranty` are included
 * whenever they exist in the library. Assembly order is DOC_KIND_ORDER.
 */
export const REQUIRED_DOC_KINDS = ["pds", "install"] as const;
export const INCLUDED_WHEN_PRESENT_KINDS = ["test_report", "warranty"] as const;
export const DOC_KIND_ORDER = ["pds", "install", "test_report", "warranty"] as const;

export const CoverSheetSchema = z.object({
  projectName: z.string().min(1),
  projectAddress: z.string().min(1),
  gcName: z.string(),
  architectName: z.string(),
  repName: z.string().min(1),
  repContact: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  packageTitle: z.string().min(1),
  /** Assigned by the runner from the ERP sequence at assembly time. */
  submittalNumber: z.string().optional(),
});

export const SectionDocSchema = z.object({
  pdsDocumentId: z.string().uuid(),
  kind: z.enum(DOC_KIND_ORDER),
  title: z.string().min(1),
});

export const SubmittalSectionSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1),
  productName: z.string().min(1),
  docs: z.array(SectionDocSchema).min(1),
  note: z.string().optional(),
});

export const SubmittalCompositionSchema = z.object({
  coverSheet: CoverSheetSchema,
  sections: z.array(SubmittalSectionSchema).min(1),
  sampleRequestNote: z.string().optional(),
});
export type SubmittalComposition = z.infer<typeof SubmittalCompositionSchema>;

// ── Propose (agent run) ──────────────────────────────────────────────────────

export type ProposeResult =
  | { status: "proposed"; runId: string; approvalId: string; composition: SubmittalComposition }
  | { status: "escalated"; runId: string; reason: string; detail: Record<string, unknown> }
  | { status: "failed"; runId: string; error: string };

export async function proposeSubmittalComposition(input: {
  projectId: string;
  productIds: string[];
  sourceEmailId?: string;
  trigger: "user" | "nightly" | "workflow";
  workflowRunId?: string;
}): Promise<ProposeResult> {
  const { submittalAgent } = await import("@/agents/submittal");
  const run = await submittalAgent.run(
    { projectId: input.projectId, productIds: input.productIds, sourceEmailId: input.sourceEmailId },
    { trigger: input.trigger, workflowRunId: input.workflowRunId },
  );
  if (run.status === "escalated") {
    return {
      status: "escalated",
      runId: run.runId,
      reason: run.escalation?.reason ?? "escalated",
      detail: run.escalation?.detail ?? {},
    };
  }
  if (run.status !== "succeeded" || !run.output || run.approvalIds.length === 0) {
    return { status: "failed", runId: run.runId, error: "composition run did not produce an approval" };
  }
  return {
    status: "proposed",
    runId: run.runId,
    approvalId: run.approvalIds[0]!,
    composition: run.output.composition,
  };
}

// ── Assemble (deterministic) ─────────────────────────────────────────────────

export type AssemblePackageResult =
  | { ok: true; packageId: string; submittalNumber: string; outputBlobUrl: string; pageCount: number }
  | { ok: false; error: string };

/**
 * Validate the (possibly human-edited) composition, verify required kinds
 * survived review, resolve documents from the library, assemble, persist the
 * package, and patch the pending approval with the package refs + optional
 * transmittal draft payload.
 */
export async function assembleSubmittalPackage(input: {
  approvalId: string;
  composition: unknown;
  sourceEmailId?: string;
  /** Prepared draft row to upgrade (routed path); omitted for fresh builds. */
  packageId?: string;
  actor: AuditActor;
}): Promise<AssemblePackageResult> {
  const parsed = SubmittalCompositionSchema.safeParse(input.composition);
  if (!parsed.success) return { ok: false, error: `invalid composition: ${parsed.error.issues[0]?.message}` };
  const composition = parsed.data;

  // Required kinds can never be edited out — compliance packages don't
  // silently omit; removing a product is the legal edit.
  for (const section of composition.sections) {
    const present = new Set(section.docs.map((d) => d.kind));
    for (const kind of REQUIRED_DOC_KINDS) {
      if (!present.has(kind)) {
        return { ok: false, error: `${section.sku} is missing required document kind "${kind}"` };
      }
    }
  }

  // Resolve every referenced document and verify it belongs to its section's
  // product — the composition may only reference the library.
  const docIds = composition.sections.flatMap((s) => s.docs.map((d) => d.pdsDocumentId));
  const docRows = await db.query.pdsDocuments.findMany({ where: inArray(pdsDocuments.id, docIds) });
  const byId = new Map(docRows.map((d) => [d.id, d]));
  for (const section of composition.sections) {
    for (const d of section.docs) {
      const row = byId.get(d.pdsDocumentId);
      if (!row) return { ok: false, error: `document ${d.pdsDocumentId} not found in the library` };
      if (row.productId !== section.productId) {
        return { ok: false, error: `document ${d.pdsDocumentId} does not belong to ${section.sku}` };
      }
    }
  }

  const projectId = await projectIdOfApproval(input.approvalId);
  if (!projectId) return { ok: false, error: "approval carries no projectId" };

  const demoNow = await getDemoNow();
  const submittalNumber = composition.coverSheet.submittalNumber ?? (await getErpProvider().nextNumber("SUB"));

  const assembled = await assembleSubmittalPdf({
    coverSheet: { ...composition.coverSheet, submittalNumber },
    sections: composition.sections.map((s) => ({
      sku: s.sku,
      productName: s.productName,
      note: s.note,
      docs: [...s.docs]
        .sort((a, b) => DOC_KIND_ORDER.indexOf(a.kind) - DOC_KIND_ORDER.indexOf(b.kind))
        .map((d) => ({ kind: d.kind, title: d.title, blobUrl: byId.get(d.pdsDocumentId)!.blobUrl })),
    })),
  });

  const blobKey = `submittals/${submittalNumber}.pdf`;
  const outputBlobUrl = await putBlob(blobKey, Buffer.from(assembled.bytes), { contentType: "application/pdf" });

  const sections: SubmittalSection[] = composition.sections.map((s) => ({
    productId: s.productId,
    sku: s.sku,
    productName: s.productName,
    docs: s.docs,
    note: s.note,
    startPage: assembled.toc.find((t) => t.sku === s.sku)?.startPage,
  }));
  const productIds = composition.sections.map((s) => s.productId);

  const values = {
    projectId,
    name: composition.coverSheet.packageTitle,
    submittalNumber,
    productIds,
    sections,
    coverSheet: { ...composition.coverSheet, submittalNumber } as Record<string, string>,
    status: "pending_approval" as const,
    outputBlobUrl,
    sourceEmailId: input.sourceEmailId ?? null,
  };

  let packageId = input.packageId ?? null;
  if (packageId) {
    await db.update(submittalPackages).set(values as typeof submittalPackages.$inferInsert).where(eq(submittalPackages.id, packageId));
  } else {
    const [row] = await db
      .insert(submittalPackages)
      .values(values as typeof submittalPackages.$inferInsert)
      .returning({ id: submittalPackages.id });
    packageId = row!.id;
  }

  // Transmittal draft payload (second approval on approve) — only when the
  // request came from a real email.
  let transmittal: Record<string, unknown> | undefined;
  if (input.sourceEmailId) {
    const mail = await db.query.emails.findFirst({ where: eq(emails.id, input.sourceEmailId) });
    if (mail) {
      const { contacts } = await import("@/db/schema");
      const contact = await db.query.contacts.findFirst({ where: eq(contacts.email, mail.fromEmail) });
      const first = (contact?.name ?? "there").split(" ")[0];
      transmittal = {
        to: [mail.fromEmail],
        subject: mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`,
        bodyText:
          `${first},\n\nSubmittal package attached — ${composition.coverSheet.packageTitle} (${submittalNumber}), ` +
          `${assembled.pageCount} pages covering ${composition.sections.map((s) => s.productName).join(", ")}. ` +
          `Cover sheet lists the full contents.\n\n` +
          (composition.sampleRequestNote ? `Sample sets for the architect are moving separately.\n\n` : "") +
          `—Cole`,
        inReplyToEmailId: mail.id,
      };
    }
  }

  // Patch the pending approval with the assembled artifact refs.
  const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, input.approvalId) });
  if (approval && approval.status === "pending") {
    await db
      .update(approvals)
      .set({
        proposedAction: {
          ...(approval.proposedAction as Record<string, unknown>),
          composition,
          sections: composition.sections.map((s) => ({
            sku: s.sku,
            productName: s.productName,
            docKinds: s.docs.map((d) => d.kind),
          })),
          submittalPackageId: packageId,
          submittalNumber,
          packageTitle: composition.coverSheet.packageTitle,
          outputBlobUrl,
          pageCount: assembled.pageCount,
          productIds,
          ...(transmittal ? { transmittal } : {}),
        },
      })
      .where(eq(approvals.id, input.approvalId));
  }

  const projectRow = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  await db.insert(activities).values({
    type: "note",
    accountId: projectRow?.accountId ?? null,
    refType: "submittal_package",
    refId: packageId,
    summary: `Submittal package drafted — ${composition.coverSheet.packageTitle} (${assembled.pageCount} pages, ${submittalNumber})`,
    occurredAt: demoNow,
  });
  await audit({
    actor: input.actor,
    action: "submittal.assembled",
    objectType: "submittal_package",
    objectId: packageId,
    detail: { submittalNumber, pageCount: assembled.pageCount, products: productIds.length },
  });

  return { ok: true, packageId, submittalNumber, outputBlobUrl, pageCount: assembled.pageCount };
}

async function projectIdOfApproval(approvalId: string): Promise<string | null> {
  const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
  const p = approval?.proposedAction as { projectId?: string } | undefined;
  return typeof p?.projectId === "string" ? p.projectId : null;
}

// ── Routed path (nightly fan-out) ────────────────────────────────────────────

/**
 * Claim the routing and prepare a DRAFT builder session — parse the product
 * SKUs and project reference out of the request email and store a draft
 * submittal_packages row the builder prefills from
 * (`/submittals/new?package=<id>`). No agent run, no assembly: product
 * selection and composition review are the human's call (module README note,
 * task 6).
 */
export async function runSubmittalFromRouting(
  routingId: string,
  opts: { trigger: "nightly" | "user" | "workflow"; workflowRunId?: string },
): Promise<{ runId: string | null; status: string; packageId?: string } | null> {
  const claimed = await claimRoutingById(routingId, null);
  if (!claimed) return null;

  const mail = await db.query.emails.findFirst({ where: eq(emails.id, claimed.emailId) });
  if (!mail) {
    await completeRouting(routingId, null);
    return { runId: null, status: "email_missing" };
  }

  // Deterministic parse: SKU codes + a seeded project name mentioned verbatim.
  const skus = [...new Set(mail.bodyText.match(/MS-[A-Z]{2}-\d{4}/g) ?? [])];
  const matchedProducts = skus.length > 0 ? await db.query.products.findMany({ where: inArray(products.sku, skus) }) : [];
  const allProjects = await db.select({ id: projects.id, name: projects.name }).from(projects);
  const projectMatch = allProjects.find((p) => mail.bodyText.includes(p.name) || mail.subject.includes(p.name));

  if (!projectMatch || matchedProducts.length === 0) {
    await completeRouting(routingId, null);
    return { runId: null, status: "unmatched_request" };
  }

  const [row] = await db
    .insert(submittalPackages)
    .values({
      projectId: projectMatch.id,
      name: `${projectMatch.name} — Submittal Package`,
      productIds: matchedProducts.map((p) => p.id),
      status: "draft",
      sourceEmailId: mail.id,
    })
    .returning({ id: submittalPackages.id });

  await audit({
    actor: "system",
    action: "submittal.prepared",
    objectType: "submittal_package",
    objectId: row!.id,
    detail: {
      routingId,
      trigger: opts.trigger,
      project: projectMatch.name,
      skus,
      builderUrl: `/submittals/new?package=${row!.id}`,
    },
  });
  await completeRouting(routingId, null);
  return { runId: null, status: "prepared", packageId: row!.id };
}
