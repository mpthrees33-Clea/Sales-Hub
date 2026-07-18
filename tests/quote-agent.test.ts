/**
 * WO-05 acceptance: pricing unit tests, SKU resolution table, and
 * agent-level runs over the two seeded quote-request emails (idempotent via
 * claim), plus the unresolved-SKU escalation path.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { resetStagedBatch } from "./helpers/reset-staged";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, approvals, emails, quotes, triageRoutings } from "@/db/schema";
import { lookupProducts } from "@/agents/tools/erp";
import { runTriageForEmail } from "@/agents/email-triage";
import { priceLines, resolvePriceList } from "@/lib/pricing";
import { runQuoteFromRouting } from "@/lib/quotes";
import { EscalationError } from "@/harness/errors";
import { sid } from "@/db/seed/ids";
import { skuOf, CATALOG, tierPriceCents } from "@/db/seed/data/catalog";
import { DEMO_NOW } from "@/db/seed/scenario";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  await resetStagedBatch();
});

const toolCtx = { runId: "test", agentName: "test", demoNow: DEMO_NOW };

describe("pricing module (pure, deterministic)", () => {
  it("selects the account tier and prices exactly", async () => {
    const piedmont = sid("account:di-piedmont");
    const pl = await resolvePriceList(piedmont);
    expect(pl.tier).toBe("distributor");
    const walnut = CATALOG.find((c) => c.sku === skuOf("Walnut Grain"))!;
    const priced = await priceLines(piedmont, [{ productId: sid(`product:${walnut.sku}`), qty: 5 }]);
    expect(priced.lines[0]!.unitPriceCents).toBe(tierPriceCents(walnut.listPriceCents, "distributor"));
    expect(priced.lines[0]!.extendedCents).toBe(5 * tierPriceCents(walnut.listPriceCents, "distributor"));
    expect(priced.subtotalCents).toBe(priced.lines[0]!.extendedCents);
  });

  it("falls back to list tier for unmapped accounts and escalates on a missing row", async () => {
    const someAccount = await db.query.accounts.findFirst({ where: eq(accounts.tier, "list") });
    const pl = await resolvePriceList(someAccount!.id);
    expect(pl.tier).toBe("list");
    await expect(
      priceLines(someAccount!.id, [{ productId: "00000000-0000-4000-8000-00000000dead", qty: 1 }]),
    ).rejects.toThrow(EscalationError);
  });

  it("escalates on invalid qty", async () => {
    const piedmont = sid("account:di-piedmont");
    const walnut = sid(`product:${skuOf("Walnut Grain")}`);
    await expect(priceLines(piedmont, [{ productId: walnut, qty: 0 }])).rejects.toThrow(EscalationError);
    await expect(priceLines(piedmont, [{ productId: walnut, qty: 2.5 }])).rejects.toThrow(EscalationError);
  });
});

describe("SKU resolution table", () => {
  it("exact, normalized, name, and unresolved-with-candidates paths", async () => {
    const walnutSku = skuOf("Walnut Grain");
    const res = (await lookupProducts.execute!(
      { queries: [walnutSku, walnutSku.toLowerCase().replace(/-/g, " "), "Walnut Grain", "MS-QQ-0000"] },
      toolCtx,
    )) as { data: { results: { resolved: string | null; method: string; candidates?: unknown[] }[] } };
    const [exact, normalized, byName, missing] = res.data.results;
    expect(exact!.method).toBe("exact");
    expect(normalized!.method).toBe("normalized");
    expect(byName!.method).toBe("name");
    expect(missing!.resolved).toBeNull();
  });
});

describe("quote agent end to end (seeded requests)", () => {
  it("both seeded quote requests → exactly one quotes row + one pending approval each; consumed routing re-run is a no-op", async () => {
    // Ensure triage has produced the routings.
    for (const key of ["in-quote-stonebridge", "in-quote-crestline"]) {
      const email = await db.query.emails.findFirst({ where: eq(emails.id, sid(`email:${key}`)) });
      if (email && !email.isProcessed) await runTriageForEmail(email.id, { trigger: "user" });
    }
    const routings = await db
      .select()
      .from(triageRoutings)
      .where(and(eq(triageRoutings.target, "quote"), eq(triageRoutings.status, "pending")));
    expect(routings).toHaveLength(2);

    for (const r of routings) {
      const result = await runQuoteFromRouting(r.id, { trigger: "user" });
      expect(result?.status).toBe("succeeded");
      const out = result!.output as { quoteNumber: string; approvalId: string; splitProposed: boolean };

      const quote = await db.query.quotes.findFirst({ where: eq(quotes.number, out.quoteNumber) });
      expect(quote).toBeTruthy();
      expect(quote!.status).toBe("pending_approval");

      // Every line's unit price equals the account's price-list row exactly.
      const priced = await priceLines(
        quote!.accountId,
        quote!.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      );
      for (let i = 0; i < quote!.lines.length; i++) {
        expect(quote!.lines[i]!.unitPriceCents).toBe(priced.lines[i]!.unitPriceCents);
        expect(quote!.lines[i]!.sourceRowId).toBe(priced.lines[i]!.priceListItemId);
      }

      const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, out.approvalId) });
      expect(approval?.kind).toBe("email_draft");
      const types = approval!.evidence.map((e) => e.type);
      expect(types).toContain("email");
      expect(types).toContain("inventory_row");
      expect(types).toContain("price_row");
      expect(approval!.evidence.length).toBeGreaterThanOrEqual(3);
      const payload = approval!.proposedAction as { quote: { latencyMs: number }; bodyText: string };
      expect(payload.quote.latencyMs).toBeGreaterThan(0);

      // Stonebridge request exercises the split (White Oak short stock).
      const sourceEmail = (r.payload as { emailId: string }).emailId;
      if (sourceEmail === sid("email:in-quote-stonebridge")) {
        expect(out.splitProposed).toBe(true);
        expect(payload.bodyText).toContain("stock is short");
      }

      // Re-running the consumed routing creates nothing.
      const rerun = await runQuoteFromRouting(r.id, { trigger: "user" });
      expect(rerun).toBeNull();
    }
  });

  it("an email referencing a nonexistent SKU escalates with candidates and creates no quotes row", async () => {
    // Craft a synthetic quote-request email + routing with an unknown SKU.
    const stonebridge = sid("account:gc-stonebridge");
    void stonebridge;
    const threadId = sid("thread:in-quote-stonebridge");
    const [email] = await db
      .insert(emails)
      .values({
        threadId,
        direction: "inbound",
        fromEmail: "marcus.hale@stonebridgeconstruction.example.com",
        toEmails: ["cole.mercer@meridian-surfaces.example.com"],
        subject: "One more line to price",
        bodyText: "Cole — also price:\n\n- Phantom Finish (MS-WG-9999) — 10 rolls\n\nThanks, Marcus",
        receivedAt: DEMO_NOW,
        attachments: [],
        isProcessed: false,
      })
      .returning({ id: emails.id });
    const [routing] = await db
      .insert(triageRoutings)
      .values({
        emailId: email!.id,
        threadId,
        category: "quote_request",
        confidence: "0.900",
        target: "quote",
        status: "pending",
        payload: { emailId: email!.id, threadId },
      })
      .returning({ id: triageRoutings.id });

    const quotesBefore = await db.$count(quotes);
    const result = await runQuoteFromRouting(routing!.id, { trigger: "user" });
    expect(result?.status).toBe("escalated");
    expect(result?.escalation?.reason).toBe("sku_unresolved");
    const detail = result!.escalation!.detail as { unresolved: { candidates: unknown[] }[] };
    expect(detail.unresolved.length).toBe(1);
    expect(await db.$count(quotes)).toBe(quotesBefore); // no quote row
    // Escalation approval exists for human input.
    expect(result!.approvalIds).toHaveLength(1);

    // cleanup synthetic rows
    await db.delete(triageRoutings).where(eq(triageRoutings.id, routing!.id));
    await db.delete(emails).where(eq(emails.id, email!.id));
  });
});
