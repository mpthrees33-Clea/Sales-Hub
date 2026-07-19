/**
 * Submittal composition contract + doc-kind policy + routing consumption
 * (WO-14). The LLM proposes the composition (which docs per product, cover
 * sheet fields); the assembler (submittal-assembler.ts) does the deterministic
 * PDF merge. A product missing a REQUIRED doc escalates — it is never silently
 * omitted from a compliance package.
 *
 * Routing note (task 6): the nightly run does NOT auto-assemble a routed
 * submittal request. Composition is where the judgment lives (which products,
 * which optional docs), so the routed path prepares a prefilled builder session
 * (deep link) for the human and leaves the routing for them to action.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emails } from "@/db/schema";
import { claimRoutingById, releaseRouting, type RoutingRow } from "@/lib/routing";

export const DocKindSchema = z.enum(["pds", "install", "test_report", "warranty"]);
export type DocKind = z.infer<typeof DocKindSchema>;

/** A compliance package an architect accepts first-pass needs these per product. */
export const REQUIRED_DOC_KINDS: DocKind[] = ["pds", "install"];
/** Included automatically when they exist for the product. */
export const OPTIONAL_DOC_KINDS: DocKind[] = ["test_report", "warranty"];
/** Assembly order within a product section. */
export const DOC_KIND_ORDER: DocKind[] = ["pds", "install", "test_report", "warranty"];

export const CoverSheetSchema = z.object({
  projectName: z.string(),
  projectAddress: z.string(),
  gcName: z.string(),
  architectName: z.string(),
  repName: z.string(),
  repContact: z.string(),
  date: z.string(),
  packageTitle: z.string(),
  submittalNumber: z.string(),
});
export type CoverSheet = z.infer<typeof CoverSheetSchema>;

export const SectionDocSchema = z.object({ pdsDocumentId: z.string(), kind: DocKindSchema, title: z.string() });
export const CompositionSectionSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  docs: z.array(SectionDocSchema).min(1),
  note: z.string().optional(),
});
export type CompositionSection = z.infer<typeof CompositionSectionSchema>;

export const CompositionSchema = z.object({
  coverSheet: CoverSheetSchema,
  sections: z.array(CompositionSectionSchema).min(1),
  sampleRequestNote: z.string().optional(),
});
export type Composition = z.infer<typeof CompositionSchema>;

/** Missing required kinds for a product given the doc kinds actually available. */
export function missingRequiredKinds(availableKinds: DocKind[]): DocKind[] {
  const have = new Set(availableKinds);
  return REQUIRED_DOC_KINDS.filter((k) => !have.has(k));
}

/** Order a product's docs for assembly (pds, install, test_report, warranty). */
export function orderDocs<T extends { kind: DocKind }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => DOC_KIND_ORDER.indexOf(a.kind) - DOC_KIND_ORDER.indexOf(b.kind));
}

/**
 * Consume a routed submittal request into a prefilled builder session. Does NOT
 * assemble (the human picks products); claims to inspect, then releases so the
 * routing stays actionable, and returns a deep link into the builder.
 */
export async function runSubmittalFromRouting(routingId: string): Promise<{ status: string; deepLink?: string; detail?: string }> {
  const claimed = await claimRoutingById(routingId);
  if (!claimed) return { status: "skipped", detail: "already_claimed" };
  try {
    const deepLink = await builderDeepLink(claimed);
    return { status: "skipped", detail: "manual_builder", deepLink };
  } finally {
    // Leave it for the human — nightly never auto-assembles a submittal.
    await releaseRouting(routingId);
  }
}

async function builderDeepLink(routing: RoutingRow): Promise<string> {
  const params = new URLSearchParams({ routing: routing.id });
  const payload = (routing.payload ?? {}) as { projectId?: string; productIds?: string[] };
  if (payload.projectId) params.set("project", payload.projectId);
  if (payload.productIds?.length) params.set("products", payload.productIds.join(","));
  // Fall back to the source email so the builder can show context.
  if (routing.emailId) {
    const e = await db.query.emails.findFirst({ where: eq(emails.id, routing.emailId) });
    if (e) params.set("subject", e.subject);
  }
  return `/submittals/new?${params.toString()}`;
}
