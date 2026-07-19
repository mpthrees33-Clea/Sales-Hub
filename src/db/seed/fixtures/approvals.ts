/**
 * `pnpm seed --with-approvals` (WO-03 task 1, dev-only): one pending approval
 * per kind with plausible typed proposed_actions, real evidence refs into
 * seeded rows, backing runs with steps, plus one pre-aged (expired) approval
 * and one generic-fallback scene_send. Fixture content obeys the docs/04
 * consistency rule.
 */
import { db } from "@/db/client";
import { agentRuns, agentSteps, approvals } from "@/db/schema";
import { assignRiskTier } from "@/harness/policy-gate";
import { skuOf } from "../data/catalog";
import { contactOf } from "../data/accounts";
import { PO_CLEAN, Q1042_LINES } from "../data/commerce";
import { sid } from "../ids";
import { DEMO_NOW, et } from "../scenario";

export async function seedApprovalFixtures(): Promise<void> {
  const demoNow = DEMO_NOW;
  const expires = new Date(demoNow.getTime() + 72 * 3600_000);

  const mkRun = async (key: string, agentName: string, stepNames: string[]) => {
    const startedAt = et("2026-03-10T05:10");
    await db.insert(agentRuns).values({
      id: sid(`apfix:run:${key}`),
      agentName,
      trigger: "nightly",
      input: { fixture: true },
      output: { fixture: true },
      status: "succeeded",
      model: "clea/demo-deterministic",
      tokensIn: 1000,
      tokensOut: 300,
      costUsd: "0.003000",
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 4000),
    });
    await db.insert(agentSteps).values(
      stepNames.map((name, i) => ({
        id: sid(`apfix:step:${key}:${i}`),
        runId: sid(`apfix:run:${key}`),
        seq: i + 1,
        kind: "tool_call" as const,
        name,
        input: null,
        output: null,
        durationMs: 100 + i * 40,
      })),
    );
    return sid(`apfix:run:${key}`);
  };

  const walnut = skuOf("Walnut Grain");
  const dana = contactOf("di-piedmont", "Dana Whitfield");
  const sofia = contactOf("ds-ateliernorth", "Sofia Marino");
  const grace = contactOf("ds-ateliernorth", "Grace Lin");
  const ray = contactOf("gc-whitaker", "Ray Delgado");

  // 1. email_draft (stock-check reply to Dana)
  {
    const runId = await mkRun("email", "email-reply", ["get_thread", "check_stock", "create_email_draft"]);
    const payload = {
      to: [dana.email],
      subject: "Re: Availability check — four SKUs",
      bodyText: `Dana,\n\nHere's where those four stand today:\n\n- Ebony (${skuOf("Ebony")}): in stock, ~9 days\n- Gunmetal (${skuOf("Gunmetal")}): in stock, ~11 days\n- Carrara Marble (${skuOf("Carrara Marble")}): in stock, ~14 days\n- Natural Cork (${skuOf("Natural Cork")}): low — I can hold what's on the shelf if you commit this week\n\nI'll get the updated sell-through numbers over to you before lunch.\n\n—Cole`,
      attachmentAssetIds: [],
      intent: "stock_check",
      inReplyToEmailId: sid("email:in-stock-piedmont"),
    };
    await db.insert(approvals).values({
      id: sid("apfix:email"),
      runId,
      kind: "email_draft",
      riskTier: assignRiskTier("email_draft", payload),
      proposedAction: payload,
      evidence: [
        { type: "email", ref: { emailId: sid("email:in-stock-piedmont") }, quote: "what's on-hand and lead time" },
        { type: "inventory_row", ref: { sku: skuOf("Ebony") }, quote: "Ebony — in stock" },
        { type: "inventory_row", ref: { sku: skuOf("Natural Cork") }, quote: "Natural Cork — low stock" },
      ],
      status: "pending",
      createdDemoAt: demoNow,
      expiresDemoAt: expires,
    });
  }

  // 2. quote (embedded in email payload contract, kind quote for the card)
  {
    const runId = await mkRun("quote", "quote", ["lookup_products", "check_stock", "get_pricing", "create_email_draft"]);
    const lines = Q1042_LINES.slice(0, 3).map((l) => ({
      productId: sid(`product:${l.sku}`),
      sku: l.sku,
      description: `${l.name} architectural film`,
      qty: l.qty,
      uom: "roll",
      unitPriceCents: l.unitPriceCents,
      extendedCents: l.qty * l.unitPriceCents,
      sourceRowId: sid(`pli:distributor:${l.sku}`),
    }));
    const totalCents = lines.reduce((a, l) => a + l.extendedCents, 0);
    await db.insert(approvals).values({
      id: sid("apfix:quote"),
      runId,
      kind: "quote",
      riskTier: assignRiskTier("quote", { totalCents }),
      proposedAction: {
        quoteNumber: "Q-1043",
        accountId: sid("account:di-piedmont"),
        accountName: "Piedmont Surface Distribution",
        lines,
        subtotalCents: totalCents,
        totalCents,
        validUntil: "2026-04-09",
        latencyMs: 4 * 60_000,
        splitProposed: false,
      },
      evidence: [
        { type: "email", ref: { emailId: sid("email:in-stock-piedmont") }, quote: "stock buy quantities" },
        { type: "price_row", ref: { priceListItemId: sid(`pli:distributor:${walnut}`) }, quote: "distributor tier" },
        { type: "inventory_row", ref: { sku: walnut }, quote: "64 on hand" },
      ],
      status: "pending",
      createdDemoAt: demoNow,
      expiresDemoAt: expires,
    });
  }

  // 3. sales_order (clean PO converted)
  {
    const runId = await mkRun("so", "po-intake", ["extract_pdf", "price_match", "create_sales_order"]);
    const lines = PO_CLEAN.lines.map((l) => ({
      productId: sid(`product:${l.sku}`),
      sku: l.sku,
      description: `${l.name} architectural film`,
      qty: l.qty,
      uom: "roll",
      unitPriceCents: l.unitPriceCents,
      extendedCents: l.qty * l.unitPriceCents,
    }));
    const totalCents = lines.reduce((a, l) => a + l.extendedCents, 0);
    await db.insert(approvals).values({
      id: sid("apfix:so"),
      runId,
      kind: "sales_order",
      riskTier: "high",
      proposedAction: {
        customerPoNumber: PO_CLEAN.number,
        accountId: sid("account:di-carolina"),
        accountName: "Carolina Architectural Products",
        lines,
        subtotalCents: totalCents,
        totalCents,
        validation: [
          { layer: 1, name: "schema_complete", pass: true, detail: {} },
          { layer: 2, name: "sku_resolution", pass: true, detail: {} },
          { layer: 3, name: "price_match", pass: true, detail: {} },
          { layer: 4, name: "qty_uom_sanity", pass: true, detail: {} },
          { layer: 5, name: "customer_shipto_match", pass: true, detail: {} },
          { layer: 6, name: "credit_terms", pass: true, detail: {} },
          { layer: 7, name: "duplicate_detection", pass: true, detail: {} },
        ],
      },
      evidence: [
        { type: "pdf_page", ref: { blobKey: `po/${PO_CLEAN.number}.pdf`, page: 1 }, quote: PO_CLEAN.number },
        { type: "price_row", ref: { priceListItemId: sid(`pli:distributor:${PO_CLEAN.lines[0]!.sku}`) }, quote: "tier price exact" },
      ],
      status: "pending",
      createdDemoAt: demoNow,
      expiresDemoAt: expires,
    });
  }

  // 4–5. sample_order ×2 (low tier — batch demo)
  const sampleDefs = [
    { key: "sample1", contact: sofia, accountKey: "ds-ateliernorth", emailKey: "in-sample-atelier", products: ["Walnut Grain", "Boucle Cloud", "Champagne Gold"] },
    { key: "sample2", contact: contactOf("ds-fostervale", "Jordan Ellery"), accountKey: "ds-fostervale", emailKey: "in-sample-fostervale", products: ["Leather Grain", "Rattan"] },
  ];
  for (const s of sampleDefs) {
    const runId = await mkRun(s.key, "sample-order", ["get_email", "lookup_contact", "resolve_sku", "propose_sample_order"]);
    await db.insert(approvals).values({
      id: sid(`apfix:${s.key}`),
      runId,
      kind: "sample_order",
      riskTier: "low",
      proposedAction: {
        accountId: sid(`account:${s.accountKey}`),
        contactId: sid(`contact:${s.accountKey}:${s.contact.name}`),
        contactName: s.contact.name,
        items: s.products.map((p) => ({ productId: sid(`product:${skuOf(p)}`), sku: skuOf(p), name: p, size: "8x10", qty: 1 })),
        shipTo: { source: "account_on_file" },
      },
      evidence: [{ type: "email", ref: { emailId: sid(`email:${s.emailKey}`) }, quote: "sample request" }],
      status: "pending",
      createdDemoAt: demoNow,
      expiresDemoAt: expires,
    });
  }

  // 6. opportunity_update (Phase 3 proposal from the transcript)
  {
    const runId = await mkRun("opp", "opportunity-update", ["get_account_context", "propose_opportunity_update"]);
    await db.insert(approvals).values({
      id: sid("apfix:opp"),
      runId,
      kind: "opportunity_update",
      riskTier: "standard",
      proposedAction: {
        accountId: sid("account:gc-whitaker"),
        accountName: "Whitaker Commercial Contractors",
        newOpportunity: {
          name: "Harborview Medical Ph3 — Outpatient Wing (planning)",
          stage: "lead",
          valueCents: 9_500_000,
          projectHint: "Harborview Medical Phase 2 follow-on",
        },
        fieldDiffs: [{ field: "__create__", old: null, new: "Harborview Medical Ph3 — Outpatient Wing (planning)" }],
        rationale: "Ray Delgado: board approved planning money for Phase 3; similar scope, breaks ground next spring.",
      },
      evidence: [
        {
          type: "transcript_segment",
          ref: { meetingId: sid("meeting:mtg-harborview-walk"), segment: 9 },
          quote: "board approved planning money for Phase 3 last week",
        },
      ],
      status: "pending",
      createdDemoAt: demoNow,
      expiresDemoAt: expires,
    });
  }

  // 7. submittal (Harborview package)
  {
    const runId = await mkRun("submittal", "submittal", ["get_project_context", "list_product_documents", "propose_submittal"]);
    const prods = ["Walnut Grain", "Matte White", "Brushed Steel"];
    await db.insert(approvals).values({
      id: sid("apfix:submittal"),
      runId,
      kind: "submittal",
      riskTier: "standard",
      proposedAction: {
        projectId: sid("project:prj-harborview2"),
        projectName: "Harborview Medical Phase 2",
        packageTitle: "Interior Film Scope — Submittal Package",
        sections: prods.map((p) => ({
          sku: skuOf(p),
          productName: p,
          docKinds: ["pds", "install", "test_report", "warranty"],
        })),
      },
      evidence: prods.map((p) => ({
        type: "pdf_page" as const,
        ref: { pdsDocumentId: sid(`pds:${skuOf(p)}:pds`) },
        quote: `pds for ${skuOf(p)}`,
      })),
      status: "pending",
      createdDemoAt: demoNow,
      expiresDemoAt: expires,
    });
  }

  // 8. scene_send — exercises the generic fallback card.
  {
    const runId = await mkRun("scene", "room-scene", ["get_product", "generate_scene"]);
    await db.insert(approvals).values({
      id: sid("apfix:scene"),
      runId,
      kind: "scene_send",
      riskTier: "standard",
      proposedAction: {
        to: [grace.email],
        sceneId: sid("scene:hero-walnut-lobby"),
        note: "Walnut Grain applied to the studio lobby wall — generic-renderer fixture",
      },
      evidence: [],
      status: "pending",
      createdDemoAt: demoNow,
      expiresDemoAt: expires,
    });
  }

  // 9. Pre-aged past expiry — renders expired, can never execute.
  {
    const runId = await mkRun("expired", "email-reply", ["get_thread", "create_email_draft"]);
    const created = new Date(demoNow.getTime() - 80 * 3600_000);
    await db.insert(approvals).values({
      id: sid("apfix:expired"),
      runId,
      kind: "email_draft",
      riskTier: "standard",
      proposedAction: {
        to: [ray.email],
        subject: "Re: last week's walkthrough",
        bodyText: "Ray — recap attached from last week.\n\n—Cole",
        attachmentAssetIds: [],
      },
      evidence: [],
      status: "pending",
      createdDemoAt: created,
      expiresDemoAt: new Date(created.getTime() + 72 * 3600_000),
    });
  }
}
