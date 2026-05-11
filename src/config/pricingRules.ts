import type { PricingRules } from '../types';

// Pricing rule defaults. Trinity reps can tune these in slice 2; for now they
// model the kind of modifiers a distributor actually applies on top of base
// net prices from the price sheet.
//
// The engine in src/lib/pricing.ts is deterministic: base price from the
// price entry → size multiplier → finish surcharge → qty discount → totals.
// If a product isn't on the sheet, the line item is marked pricingPending
// and the AI draft says "pricing pending — contact rep."

export const DEFAULT_PRICING_RULES: PricingRules = {
  sizeTiers: [
    // Large-format tile + plank — premium for handling, lower install yield
    { matches: ['24x24', '24x48', '24"', 'large-format', 'lf'], multiplier: 1.10 },
    { matches: ['12x24', '12"x24"'], multiplier: 1.05 },
    // Standard sizes — base price
    { matches: ['12x12', '6x24', '6"x24"', '5in plank', '5" plank', '7in plank', '7" plank'], multiplier: 1.0 },
    // Mosaic / accent — labor-heavy on install, slight premium
    { matches: ['mosaic', 'hex', '4in', '4"', '3x6'], multiplier: 1.15 },
  ],
  finishSurcharges: [
    { finish: 'polished', amountPerUnit: 0.35 },
    { finish: 'honed', amountPerUnit: 0.20 },
    { finish: 'hand-scraped', amountPerUnit: 0.25 },
    { finish: 'wire-brushed', amountPerUnit: 0.30 },
    { finish: 'distressed', amountPerUnit: 0.20 },
    { finish: 'embossed', amountPerUnit: 0.10 },
    // 'matte' and 'satin' have no surcharge
  ],
  qtyDiscountTiers: [
    // Discount applied to the (modified) unit price for orders above threshold.
    // Thresholds are in the product's base unit (sq ft for most flooring,
    // sq yd for carpet).
    { minQty: 50_000, discountPct: 0.12 },
    { minQty: 25_000, discountPct: 0.08 },
    { minQty: 10_000, discountPct: 0.05 },
    { minQty: 5_000,  discountPct: 0.03 },
    { minQty: 2_000,  discountPct: 0.015 },
  ],
};
