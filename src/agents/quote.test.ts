/**
 * WO-05 agent-level acceptance: a seeded quote request produces exactly one
 * quotes row + one pending email_draft approval with ≥ 3 evidence items and
 * prices equal to priceLines output (no model-authored prices); a re-run of a
 * consumed routing creates nothing; an unresolved SKU escalates with no quote.
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, contacts, emails, emailThreads, quotes, triageRoutings } from "@/db/schema";
import { triageUnprocessed } from "@/agents/email-triage";
import { runQuoteFromRouting } from "@/lib/quotes";
import { priceLines } from "@/lib/pricing";

beforeAll(async () => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
  await triageUnprocessed({ trigger: "user" }); // creates quote-target routings
}, 90_000);

describe("runQuoteFromRouting", () => {
  it("drafts a quote with prices from priceLines and ≥3 evidence items", async () => {
    const routing = await db.query.triageRoutings.findFirst({ where: and(eq(triageRoutings.target, "quote"), eq(triageRoutings.status, "pending")) });
    expect(routing).toBeTruthy();

    const quotesBefore = await db.$count(quotes);
    const result = await runQuoteFromRouting(routing!.id);
    expect(result.status).toBe("drafted");
    if (result.status !== "drafted") return;

    expect(await db.$count(quotes)).toBe(quotesBefore + 1);
    const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, result.quoteId) });
    expect(quote?.status).toBe("pending_approval");

    // Prices are exactly priceLines output — not model text.
    const recomputed = await priceLines(quote!.accountId, quote!.lines.map((l) => ({ productId: l.productId, qty: l.qty })));
    for (let i = 0; i < quote!.lines.length; i++) {
      expect(quote!.lines[i]!.unitPriceCents).toBe(recomputed.lines[i]!.unitPriceCents);
    }

    const appr = await db.query.approvals.findFirst({ where: eq(approvals.id, result.approvalId!) });
    expect(appr?.kind).toBe("email_draft");
    expect(appr?.status).toBe("pending");
    expect(appr!.evidence.length).toBeGreaterThanOrEqual(3);
    const types = new Set(appr!.evidence.map((e) => e.type));
    expect(types.has("email")).toBe(true);
    expect(types.has("inventory_row")).toBe(true);
    expect(types.has("price_row")).toBe(true);

    // Idempotent: a consumed routing can't be re-claimed.
    const rerun = await runQuoteFromRouting(routing!.id);
    expect(rerun.status).toBe("skipped");
    expect(await db.$count(quotes)).toBe(quotesBefore + 1);
  });

  it("escalates on an unresolved SKU and creates no quote", async () => {
    // Synthetic thread/email from a SEEDED contact (so the account resolves) that
    // references a non-existent SKU — the resolution step must escalate.
    const [contact] = await db.select({ email: contacts.email }).from(contacts).limit(1);
    const threadId = randomUUID();
    const emailId = randomUUID();
    const routingId = randomUUID();
    await db.insert(emailThreads).values({ id: threadId, subject: "quote please", participants: [contact!.email], lastMessageAt: new Date() });
    await db.insert(emails).values({
      id: emailId,
      threadId,
      direction: "inbound",
      fromEmail: contact!.email,
      toEmails: ["cole@x.example.com"],
      subject: "quote please",
      bodyText: "Please price MS-ZZ-9999 — 10 rolls.",
      receivedAt: new Date(),
    });
    await db.insert(triageRoutings).values({ id: routingId, emailId, threadId, category: "quote_request", confidence: "0.900", target: "quote", status: "pending" });

    const quotesBefore = await db.$count(quotes);
    const result = await runQuoteFromRouting(routingId);
    expect(result.status).toBe("escalated");
    expect(await db.$count(quotes)).toBe(quotesBefore);
  });
});
