/**
 * submittal (WO-14) — compose a compliance submittal package an architect will
 * accept first-pass. READ tools (project context, product documents) + one
 * external tool that, on being called, deterministically assembles the merged
 * PDF and files a `submittal` approval. A product missing a REQUIRED document
 * escalates (missing_document) — it is NEVER silently omitted. The LLM proposes
 * composition; pdf-lib does the assembly; the human approves the send.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, pdsDocuments, products, projects, submittalPackages } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { EscalationError } from "@/harness/errors";
import { scopedTool } from "@/harness/tool";
import { MODELS } from "@/lib/ai/models";
import { audit } from "@/lib/audit";
import { formatDateLong, repDateKey } from "@/lib/dates";
import { REP } from "@/lib/rep";
import { assembleSubmittalPdf } from "@/lib/submittal-assembler";
import { CompositionSchema, missingRequiredKinds, orderDocs, type Composition, type DocKind } from "@/lib/submittals";

type ProjectCtx = { projectId: string; projectName: string; projectAddress: string; gcName: string; architectName: string; accountName: string };
type ProductDoc = { pdsDocumentId: string; kind: DocKind; title: string };
type ProductDocs = { productId: string; sku: string; productName: string; docs: ProductDoc[] };

const getProjectContext = scopedTool<{ projectId: string }>({
  name: "get_project_context",
  description: "Project, address, GC, architect, and owner account for the cover sheet.",
  effect: "read",
  inputSchema: z.object({ projectId: z.string() }),
  execute: async ({ projectId }) => {
    const proj = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!proj) throw new EscalationError("project_not_found", { projectId });
    const account = await db.query.accounts.findFirst({ where: eq(accounts.id, proj.accountId) });
    const a = proj.address;
    const ctx: ProjectCtx = {
      projectId: proj.id,
      projectName: proj.name,
      projectAddress: `${a.line1}, ${a.city}, ${a.state} ${a.zip}`,
      gcName: proj.gcName ?? account?.name ?? "General Contractor",
      architectName: proj.architectName ?? "Architect of Record",
      accountName: account?.name ?? "",
    };
    return { data: { project: ctx } };
  },
});

const listProductDocuments = scopedTool<{ productId: string }>({
  name: "list_product_documents",
  description: "PDS documents available for a product (pds/install/test_report/warranty) with kinds and titles. Emits one evidence item per document.",
  effect: "read",
  inputSchema: z.object({ productId: z.string() }),
  execute: async ({ productId }) => {
    const [prod] = await db.select({ id: products.id, sku: products.sku, name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
    if (!prod) throw new EscalationError("product_not_found", { productId });
    const docs = await db.select({ id: pdsDocuments.id, kind: pdsDocuments.kind, title: pdsDocuments.title }).from(pdsDocuments).where(eq(pdsDocuments.productId, productId));
    const result: ProductDocs = { productId, sku: prod.sku, productName: prod.name, docs: docs.map((d) => ({ pdsDocumentId: d.id, kind: d.kind, title: d.title })) };
    return {
      data: { product: result },
      evidence: docs.map((d) => ({ type: "pdf_page" as const, ref: { pdsDocumentId: d.id }, quote: `${d.kind} for ${prod.sku}` })),
    };
  },
});

const ProposeInput = CompositionSchema.extend({ projectId: z.string() });

const proposeSubmittal = scopedTool<z.infer<typeof ProposeInput>>({
  name: "propose_submittal",
  description: "Assemble the merged submittal PDF and file it for approval (EXTERNAL — becomes a submittal approval; nothing is sent).",
  effect: "external",
  inputSchema: ProposeInput,
  approval: {
    kind: "submittal",
    toProposedAction: async (input) => {
      const { projectId, ...composition } = input;
      const c = CompositionSchema.parse(composition);
      // Deterministic assembly of the real PDFs → stored package + attachable-on-approval blob.
      const key = `submittals/${slug(c.coverSheet.submittalNumber)}-${slug(c.coverSheet.packageTitle)}.pdf`;
      const assembled = await assembleSubmittalPdf(c, key);
      const [row] = await db
        .insert(submittalPackages)
        .values({
          projectId,
          name: c.coverSheet.packageTitle,
          submittalNumber: c.coverSheet.submittalNumber,
          productIds: c.sections.map((s) => s.productId),
          sections: assembled.sections,
          coverSheet: c.coverSheet as unknown as Record<string, string>,
          status: "pending_approval",
          outputBlobUrl: assembled.blobUrl,
        })
        .returning({ id: submittalPackages.id });
      await audit({ actor: "agent:submittal", action: "submittal.assembled", objectType: "submittal_package", objectId: row!.id, detail: { pages: assembled.pages, sections: c.sections.length } });
      return {
        projectId,
        projectName: c.coverSheet.projectName,
        packageTitle: c.coverSheet.packageTitle,
        submittalNumber: c.coverSheet.submittalNumber,
        submittalPackageId: row!.id,
        outputBlobUrl: assembled.blobUrl,
        pages: assembled.pages,
        coverSheet: c.coverSheet,
        sampleRequestNote: c.sampleRequestNote,
        sections: c.sections.map((s) => ({ productId: s.productId, sku: s.sku, productName: s.productName, docKinds: orderDocs(s.docs).map((d) => d.kind) })),
      };
    },
  },
});

const outputSchema = CompositionSchema;

export const submittalAgent = defineAgent<{ projectId: string; productIds: string[]; routingId?: string }, Composition>({
  name: "submittal",
  description: "Project + products → a merged submittal package (cover, TOC, dividers, docs) filed for approval. Read + one gated external.",
  model: MODELS.frontier,
  maxSteps: 6,
  inputSchema: z.object({ projectId: z.string(), productIds: z.array(z.string()).min(1), routingId: z.string().optional() }),
  outputSchema,
  tools: [getProjectContext, listProductDocuments, proposeSubmittal],
  escalationApprovalKind: "submittal",
  escalationContext: (input) => ({ projectId: input.projectId, productIds: input.productIds }),
  systemPrompt: () =>
    "Compose a package an architect accepts with no exceptions taken: every product needs at minimum its PDS and installation guide; include test reports and warranties when present. " +
    "Never claim a document exists that list_product_documents did not return. Cover-sheet fields come only from get_project_context and the rep profile. Escalate any product missing a required document — do not omit it.",
  demoScript: async ({ input, tools, demoNow }) => {
    const { project } = (await tools.get_project_context!({ projectId: input.projectId })) as { project: ProjectCtx };

    const sections: Composition["sections"] = [];
    for (const productId of input.productIds) {
      const { product } = (await tools.list_product_documents!({ productId })) as { product: ProductDocs };
      const available = product.docs.map((d) => d.kind);
      const missing = missingRequiredKinds(available);
      if (missing.length) throw new EscalationError("missing_document", { productId, sku: product.sku, productName: product.productName, missing });
      sections.push({ productId, sku: product.sku, productName: product.productName, docs: orderDocs(product.docs) });
    }

    const composition: Composition = {
      coverSheet: {
        projectName: project.projectName,
        projectAddress: project.projectAddress,
        gcName: project.gcName,
        architectName: project.architectName,
        repName: REP.name,
        repContact: `${REP.email} · ${REP.phone}`,
        date: formatDateLong(demoNow),
        packageTitle: `${project.projectName} — Interior Film Submittal`,
        submittalNumber: `SUB-${repDateKey(demoNow).replace(/-/g, "")}-01`,
      },
      sections,
    };
    await tools.propose_submittal!({ projectId: input.projectId, ...composition });
    return composition;
  },
});

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}
