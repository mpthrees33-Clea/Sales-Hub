/**
 * WO-04: the deterministic category→target map, and claim atomicity — two
 * concurrent claims on one routing must yield exactly one winner.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, emails, emailThreads, triageRoutings } from "@/db/schema";
import { categoryToTarget, claimRoutingById, type TriageCategory } from "@/lib/routing";

describe("categoryToTarget", () => {
  const table: [TriageCategory, string][] = [
    ["quote_request", "quote"],
    ["po", "po_intake"],
    ["sample_request", "sample"],
    ["stock_check", "reply"],
    ["scheduling", "reply"],
    ["general", "reply"],
    ["submittal_request", "submittal"],
    ["noise", "none"],
  ];
  it.each(table)("maps %s → %s", (category, target) => {
    expect(categoryToTarget(category)).toBe(target);
  });
});

describe("claim atomicity", () => {
  const threadId = randomUUID();
  const emailId = randomUUID();
  const runId = randomUUID();
  const routingId = randomUUID();

  beforeAll(async () => {
    await db.insert(emailThreads).values({ id: threadId, subject: "atomicity fixture", participants: ["a@b.example.com"], lastMessageAt: new Date() });
    await db.insert(emails).values({
      id: emailId,
      threadId,
      direction: "inbound",
      fromEmail: "a@b.example.com",
      toEmails: ["cole@x.example.com"],
      subject: "atomicity fixture",
      bodyText: "body",
      receivedAt: new Date(),
    });
    await db.insert(agentRuns).values({ id: runId, agentName: "test", trigger: "user", status: "succeeded" });
    await db.insert(triageRoutings).values({ id: routingId, emailId, threadId, category: "general", confidence: "0.900", target: "reply", status: "pending" });
  });

  afterAll(async () => {
    await db.delete(triageRoutings).where(eq(triageRoutings.id, routingId));
    await db.delete(agentRuns).where(eq(agentRuns.id, runId));
    await db.delete(emails).where(eq(emails.id, emailId));
    await db.delete(emailThreads).where(eq(emailThreads.id, threadId));
  });

  it("two concurrent claims on one routing → exactly one winner", async () => {
    const [a, b] = await Promise.all([claimRoutingById(routingId, runId), claimRoutingById(routingId, runId)]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
    const row = await db.query.triageRoutings.findFirst({ where: eq(triageRoutings.id, routingId) });
    expect(row?.status).toBe("in_progress");
  });
});
