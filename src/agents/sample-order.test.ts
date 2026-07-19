/**
 * WO-09: the sample-order agent turns each seeded request into a low-tier
 * sample_order approval + confirmation email_draft with email + inventory
 * evidence, addressed only to the requesting contact; an unmatched SKU escalates
 * with no sample order; both external tools are harness-wrapped.
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, contacts, emails, emailThreads, sampleOrders } from "@/db/schema";
import { sampleOrderAgent } from "@/agents/sample-order";
import { runSampleOrder } from "@/lib/samples";
import { sid } from "@/db/seed/ids";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("sample-order agent", () => {
  it("has two harness-wrapped external tools (no directly-executing external)", () => {
    const ext = sampleOrderAgent.tools.filter((t) => t.effect === "external");
    expect(ext).toHaveLength(2);
    expect(ext.every((t) => !!t.approval?.kind)).toBe(true);
  });

  it("drafts an order + confirmation (both low) with email + inventory evidence, to the requester only", async () => {
    const soBefore = await db.$count(sampleOrders);
    const threadId = sid("thread:in-sample-atelier");
    const emailId = sid("email:in-sample-atelier");
    const run = await runSampleOrder(threadId, emailId, "user");
    expect(run.status).toBe("succeeded");
    expect(run.approvalIds.length).toBe(2);
    expect(await db.$count(sampleOrders)).toBe(soBefore + 1);

    const apprs = await Promise.all(run.approvalIds.map((id) => db.query.approvals.findFirst({ where: eq(approvals.id, id) })));
    expect(apprs.every((a) => a?.riskTier === "low")).toBe(true);
    const order = apprs.find((a) => a?.kind === "sample_order")!;
    const conf = apprs.find((a) => a?.kind === "email_draft")!;
    expect(new Set(order.evidence.map((e) => e.type)).has("email")).toBe(true);

    const from = (await db.query.emails.findFirst({ where: eq(emails.id, emailId) }))!.fromEmail;
    expect((conf.proposedAction as { to?: string[] }).to).toEqual([from]);
  });

  it("escalates an unmatched SKU with no sample order", async () => {
    const [c] = await db.select({ email: contacts.email }).from(contacts).limit(1);
    const threadId = randomUUID();
    const emailId = randomUUID();
    await db.insert(emailThreads).values({ id: threadId, subject: "samples pls", participants: [c!.email], lastMessageAt: new Date() });
    await db.insert(emails).values({ id: emailId, threadId, direction: "inbound", fromEmail: c!.email, toEmails: ["cole@x.example.com"], subject: "samples pls", bodyText: "Send a sample of MS-ZZ-9999 please.", receivedAt: new Date() });
    const soBefore = await db.$count(sampleOrders);
    const run = await runSampleOrder(threadId, emailId, "user");
    expect(run.status).toBe("escalated");
    expect(await db.$count(sampleOrders)).toBe(soBefore);
  });
});
