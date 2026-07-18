/**
 * WO-02 acceptance: the dashboard KPI window math matches hand-computed sums of
 * the seeded sales_orders/invoices for the demo week/month, the current week
 * reads ~85% of the $45k created target, sparklines equal the seeded weekly
 * history, and every window shifts when demo_now moves (no `new Date()`).
 */
import { afterAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { addDays } from "date-fns";
import { kpis } from "@/lib/queries/dashboard";
import { setDemoNow } from "@/lib/demo-clock";
import {
  CURRENT_WEEK_CREATED_CENTS,
  CURRENT_WEEK_INVOICED_CENTS,
  DEMO_NOW,
  TARGET_CREATED_WEEK_CENTS,
  TARGET_INVOICED_WEEK_CENTS,
  WEEKLY_CREATED_CENTS,
  WEEKLY_INVOICED_CENTS,
} from "@/db/seed/scenario";

// Hand-computed from the seeded history (March = Mar 2 week + Mar 9 week).
const CREATED_MONTH_CENTS = 4_650_000 + CURRENT_WEEK_CREATED_CENTS; // 8,480,000
const INVOICED_MONTH_CENTS = 4_120_000 + CURRENT_WEEK_INVOICED_CENTS; // 7,510,000

afterAll(async () => {
  // Restore the demo clock for any later serial suites.
  await setDemoNow(DEMO_NOW);
});

describe("dashboard KPI window math", () => {
  it("computes week/month created and invoiced from seeded totals", async () => {
    await setDemoNow(DEMO_NOW);
    const k = await kpis();

    expect(k.createdWk.valueCents).toBe(CURRENT_WEEK_CREATED_CENTS);
    expect(k.createdWk.targetCents).toBe(TARGET_CREATED_WEEK_CENTS);
    expect(k.createdMo.valueCents).toBe(CREATED_MONTH_CENTS);

    expect(k.invoicedWk.valueCents).toBe(CURRENT_WEEK_INVOICED_CENTS);
    expect(k.invoicedWk.targetCents).toBe(TARGET_INVOICED_WEEK_CENTS);
    expect(k.invoicedMo.valueCents).toBe(INVOICED_MONTH_CENTS);
  });

  it("current week reads ~85% of the created target", async () => {
    await setDemoNow(DEMO_NOW);
    const k = await kpis();
    const pace = k.createdWk.valueCents / k.createdWk.targetCents;
    expect(pace).toBeGreaterThan(0.83);
    expect(pace).toBeLessThan(0.87);
    expect(k.createdWk.deltaPct).toBe(-15);
  });

  it("sparklines equal the eight seeded history weeks (oldest → newest)", async () => {
    await setDemoNow(DEMO_NOW);
    const k = await kpis();
    expect(k.createdWk.spark).toEqual([...WEEKLY_CREATED_CENTS]);
    expect(k.invoicedWk.spark).toEqual([...WEEKLY_INVOICED_CENTS]);
    // Created and invoiced tiles carry their metric's weekly series.
    expect(k.createdMo.spark).toEqual([...WEEKLY_CREATED_CENTS]);
    expect(k.invoicedMo.spark).toEqual([...WEEKLY_INVOICED_CENTS]);
  });

  it("shifts every window when demo_now advances a week", async () => {
    try {
      await setDemoNow(new Date(addDays(DEMO_NOW, 7).getTime()));
      const k = await kpis();
      // The new current week (Mar 16) has no seeded orders/invoices.
      expect(k.createdWk.valueCents).toBe(0);
      expect(k.invoicedWk.valueCents).toBe(0);
      // The spark window now ends on the previously-current week.
      expect(k.createdWk.spark.at(-1)).toBe(CURRENT_WEEK_CREATED_CENTS);
      expect(k.invoicedWk.spark.at(-1)).toBe(CURRENT_WEEK_INVOICED_CENTS);
    } finally {
      await setDemoNow(DEMO_NOW);
    }
  });
});
