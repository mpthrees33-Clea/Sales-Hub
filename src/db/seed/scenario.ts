/**
 * Fixed demo-day timeline (docs/04 §1–2). demo_now = Tuesday, March 10 2026,
 * 6:55 AM America/New_York (EDT, UTC-4). "Yesterday" (Monday Mar 9) holds the
 * unprocessed overnight batch; 8 weeks of commerce history precede it.
 */

export const SCENARIO_VERSION = "v1";

/** Tue 2026-03-10 06:55 EDT */
export const DEMO_NOW = new Date("2026-03-10T10:55:00Z");

/** Helper: a Date at rep-local wall time on the demo timeline (EDT offset -4 after Mar 8 2026, EST -5 before). */
export function et(iso: `${number}-${number}-${number}T${number}:${number}`): Date {
  const dstStart = "2026-03-08";
  const offset = iso.slice(0, 10) >= dstStart ? "-04:00" : "-05:00";
  return new Date(`${iso}:00${offset}`);
}

export const MONDAY = "2026-03-09";
export const TUESDAY = "2026-03-10";

/** Mondays of the 8 history weeks (oldest first), then the current week. */
export const HISTORY_WEEK_MONDAYS = [
  "2026-01-12",
  "2026-01-19",
  "2026-01-26",
  "2026-02-02",
  "2026-02-09",
  "2026-02-16",
  "2026-02-23",
  "2026-03-02",
] as const;
export const CURRENT_WEEK_MONDAY = "2026-03-09";

/** Weekly targets (docs/04 §1): created $45k/wk, invoiced $40k/wk. */
export const TARGET_CREATED_WEEK_CENTS = 4_500_000;
export const TARGET_INVOICED_WEEK_CENTS = 4_000_000;
export const TARGET_CREATED_MONTH_CENTS = 18_000_000;
export const TARGET_INVOICED_MONTH_CENTS = 16_000_000;

/**
 * Weekly created totals (cents) for the 8 history weeks — believable pace
 * around the $45k target; KPI tests assert against these exact numbers.
 */
export const WEEKLY_CREATED_CENTS = [
  4_120_000, 4_760_000, 3_980_000, 5_140_000, 4_420_000, 4_010_000, 4_890_000, 4_650_000,
] as const;
/** Current week (Mon Mar 9 only, as of Tue 6:55am): ~85% of $45k. */
export const CURRENT_WEEK_CREATED_CENTS = 3_830_000;

/** Weekly invoiced totals for the same weeks. */
export const WEEKLY_INVOICED_CENTS = [
  3_760_000, 4_180_000, 3_650_000, 4_540_000, 4_060_000, 3_710_000, 4_310_000, 4_120_000,
] as const;
export const CURRENT_WEEK_INVOICED_CENTS = 3_390_000;

/** The seeded outstanding quote the mismatch PO references (docs/04 §2.3). */
export const QUOTE_1042_NUMBER = "Q-1042";
export const QUOTE_1041_NUMBER = "Q-1041";

/** Hero SKU (docs/04 §1). */
export const HERO_SKU = "MS-WG-1147";

/** Seeded PO numbers (fixtures generated with pdf-lib). */
export const PO_CLEAN_NUMBER = "PO-88231";
export const PO_MISMATCH_NUMBER = "PO-55107";
