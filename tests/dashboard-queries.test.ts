/**
 * KPI window math vs seeded totals (WO-02 acceptance): current week reads the
 * exact seeded created/invoiced sums (~85% of the $45k target), month windows
 * aggregate the March weeks, and shifting demo_now shifts every window.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { invalidateDemoClockCache, setDemoNow } from "@/lib/demo-clock";
import { kpis, todaysDocket } from "@/lib/queries/dashboard";
import {
  CURRENT_WEEK_CREATED_CENTS,
  CURRENT_WEEK_INVOICED_CENTS,
  DEMO_NOW,
  TARGET_CREATED_WEEK_CENTS,
  WEEKLY_CREATED_CENTS,
  WEEKLY_INVOICED_CENTS,
} from "@/db/seed/scenario";

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
});

afterAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
});

describe("dashboard KPIs", () => {
  it("current week created matches the seeded total (~85% of target)", async () => {
    const k = await kpis();
    expect(k.createdWk.valueCents).toBe(CURRENT_WEEK_CREATED_CENTS);
    expect(k.createdWk.targetCents).toBe(TARGET_CREATED_WEEK_CENTS);
    const pct = k.createdWk.valueCents / k.createdWk.targetCents;
    expect(pct).toBeGreaterThan(0.8);
    expect(pct).toBeLessThan(0.9);
  });

  it("current week invoiced matches the seeded total", async () => {
    const k = await kpis();
    expect(k.invoicedWk.valueCents).toBe(CURRENT_WEEK_INVOICED_CENTS);
  });

  it("month created = March weeks (Mar 2 history week + current)", async () => {
    const k = await kpis();
    expect(k.createdMo.valueCents).toBe(WEEKLY_CREATED_CENTS[7]! + CURRENT_WEEK_CREATED_CENTS);
    expect(k.invoicedMo.valueCents).toBe(WEEKLY_INVOICED_CENTS[7]! + CURRENT_WEEK_INVOICED_CENTS);
  });

  it("8-point sparkline carries the seeded weekly history", async () => {
    const k = await kpis();
    expect(k.createdWk.spark).toHaveLength(8);
    // last point = current week, second-to-last = the Mar 2 history week
    expect(k.createdWk.spark[7]).toBe(CURRENT_WEEK_CREATED_CENTS);
    expect(k.createdWk.spark[6]).toBe(WEEKLY_CREATED_CENTS[7]);
  });

  it("shifting demo_now +7 days shifts every KPI window", async () => {
    await setDemoNow(new Date(DEMO_NOW.getTime() + 7 * 86_400_000));
    invalidateDemoClockCache();
    const k = await kpis();
    // The new current week (Mar 16) has no seeded orders.
    expect(k.createdWk.valueCents).toBe(0);
    // The month now includes all three March weeks.
    expect(k.createdMo.valueCents).toBe(WEEKLY_CREATED_CENTS[7]! + CURRENT_WEEK_CREATED_CENTS);
    await setDemoNow(DEMO_NOW);
    invalidateDemoClockCache();
  });
});

describe("today's docket (via CalendarProvider)", () => {
  it("lists the 3 seeded Tuesday meetings chronologically with the next one marked", async () => {
    const items = await todaysDocket();
    expect(items).toHaveLength(3);
    const times = items.map((m) => m.startsAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(items[0]!.isNext).toBe(true); // 9:30 is next at 6:55 AM
    expect(items.map((m) => m.title)).toContain("Piedmont Surface — distributor lunch");
  });
});
