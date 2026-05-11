import type {
  Product,
  PriceEntry,
  PricingRules,
  Quote,
  QuoteLineItem,
  QuoteMissingField,
} from '../types';
import { DEFAULT_PRICING_RULES } from '../config/pricingRules';

// Pure pricing engine. No LLM. Takes raw line-item requests (what came out of
// the email classifier or rep input), looks up base prices from the price
// sheet, applies deterministic modifier rules, returns a quote scaffold.
//
// "Pricing pending" markers fire when:
//   - The product isn't on the price sheet (no PriceEntry match)
//   - A required spec field (size/color/finish/qty) is missing
//
// In both cases the line item still appears in the quote — the rep sees a
// [PLACEHOLDER] gap or "pricing pending" note instead of a confident wrong
// number.

export interface LineItemRequest {
  productName: string;            // raw name from email or rep
  productId?: string;             // if already matched
  size?: string;
  color?: string;
  finish?: string;
  quantity?: number;
  unit?: string;
}

export interface BuildQuoteInput {
  repId: string;
  projectId?: string;
  customerId?: string;
  requests: LineItemRequest[];
  products: Product[];
  priceEntries: PriceEntry[];
  notes?: string;
  rules?: PricingRules;
}

export interface BuildQuoteResult {
  quote: Quote;
  hasPlaceholders: boolean;       // true when any line item is missing required fields
  hasPricingPending: boolean;     // true when any product isn't on the sheet
}

const REQUIRED_LINE_FIELDS: { field: QuoteMissingField; key: keyof LineItemRequest }[] = [
  { field: 'size', key: 'size' },
  { field: 'color', key: 'color' },
  { field: 'finish', key: 'finish' },
  { field: 'quantity', key: 'quantity' },
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function matchProduct(
  request: LineItemRequest,
  products: Product[],
): Product | undefined {
  if (request.productId) {
    return products.find((p) => p.id === request.productId);
  }
  const q = request.productName.toLowerCase().trim();
  if (!q) return undefined;
  return products.find((p) => {
    if (p.trinityName.toLowerCase().includes(q)) return true;
    if (p.trinitySku.toLowerCase().includes(q)) return true;
    if (p.category.toLowerCase() === q) return true;
    if (p.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return p.privateLabels.some(
      (pl) =>
        pl.brand.toLowerCase().includes(q) ||
        pl.productName.toLowerCase().includes(q) ||
        pl.sku.toLowerCase().includes(q),
    );
  });
}

function findBasePrice(productId: string, priceEntries: PriceEntry[]): PriceEntry | undefined {
  // Prefer the lowest net price for the product (best-available pricing).
  const matches = priceEntries.filter((e) => e.productId === productId);
  if (!matches.length) return undefined;
  return matches.reduce((best, cur) => (cur.netPrice < best.netPrice ? cur : best));
}

function sizeMultiplier(size: string | undefined, rules: PricingRules): number {
  if (!size) return 1.0;
  const s = size.toLowerCase();
  for (const tier of rules.sizeTiers) {
    if (tier.matches.some((m) => s.includes(m.toLowerCase()))) {
      return tier.multiplier;
    }
  }
  return 1.0;
}

function finishSurcharge(finish: string | undefined, rules: PricingRules): number {
  if (!finish) return 0;
  const f = finish.toLowerCase();
  const match = rules.finishSurcharges.find((s) => f.includes(s.finish.toLowerCase()));
  return match?.amountPerUnit ?? 0;
}

function qtyDiscount(qty: number | undefined, rules: PricingRules): number {
  if (!qty) return 0;
  // tiers sorted desc by minQty in the config; take the first match
  for (const tier of rules.qtyDiscountTiers) {
    if (qty >= tier.minQty) return tier.discountPct;
  }
  return 0;
}

export function buildLineItem(
  request: LineItemRequest,
  products: Product[],
  priceEntries: PriceEntry[],
  rules: PricingRules = DEFAULT_PRICING_RULES,
): QuoteLineItem {
  const product = matchProduct(request, products);
  const placeholderFields: QuoteMissingField[] = [];

  for (const { field, key } of REQUIRED_LINE_FIELDS) {
    if (request[key] === undefined || request[key] === null || request[key] === '') {
      placeholderFields.push(field);
    }
  }

  const baseEntry = product ? findBasePrice(product.id, priceEntries) : undefined;
  const pricingPending = !product || !baseEntry;

  let unitPrice: number | undefined;
  let totalPrice: number | undefined;

  if (!pricingPending && baseEntry && request.quantity) {
    const base = baseEntry.netPrice;
    const sizeMul = sizeMultiplier(request.size, rules);
    const finishAdd = finishSurcharge(request.finish, rules);
    const discountPct = qtyDiscount(request.quantity, rules);
    const adjusted = (base * sizeMul + finishAdd) * (1 - discountPct);
    unitPrice = Math.round(adjusted * 100) / 100;
    totalPrice = Math.round(unitPrice * request.quantity * 100) / 100;
  }

  return {
    id: newId('li'),
    productId: product?.id,
    productName: product?.trinityName ?? request.productName,
    size: request.size,
    color: request.color,
    finish: request.finish,
    quantity: request.quantity,
    unit: request.unit ?? product?.unit ?? 'sq ft',
    unitPrice,
    totalPrice,
    pricingPending: pricingPending || undefined,
    placeholderFields: placeholderFields.length ? placeholderFields : undefined,
  };
}

export function buildQuote(input: BuildQuoteInput): BuildQuoteResult {
  const rules = input.rules ?? DEFAULT_PRICING_RULES;
  const lineItems = input.requests.map((r) =>
    buildLineItem(r, input.products, input.priceEntries, rules),
  );

  const subtotal = lineItems.reduce((sum, li) => sum + (li.totalPrice ?? 0), 0);
  const hasPlaceholders = lineItems.some((li) => li.placeholderFields?.length);
  const hasPricingPending = lineItems.some((li) => li.pricingPending);

  const quote: Quote = {
    id: newId('q'),
    repId: input.repId,
    projectId: input.projectId,
    customerId: input.customerId,
    createdDate: new Date().toISOString(),
    lineItems,
    subtotal: subtotal > 0 ? Math.round(subtotal * 100) / 100 : undefined,
    notes: input.notes,
    status: 'draft',
  };

  return { quote, hasPlaceholders, hasPricingPending };
}

// Format a line item for inclusion in a draft email body. Renders [NEEDED: x]
// placeholders inline so the rep can fill them before sending.
export function renderLineItemText(li: QuoteLineItem): string {
  const parts: string[] = [li.productName];
  parts.push(li.size ?? '[NEEDED: size]');
  parts.push(li.color ?? '[NEEDED: color]');
  parts.push(li.finish ?? '[NEEDED: finish]');
  const qty = li.quantity ?? '[NEEDED: qty]';
  const unit = li.unit;
  const priceText = li.pricingPending
    ? 'pricing pending — contact rep'
    : li.unitPrice !== undefined && li.quantity !== undefined
      ? `${qty} ${unit} @ $${li.unitPrice.toFixed(2)}/${unit} = $${li.totalPrice?.toFixed(2)}`
      : `${qty} ${unit}`;
  return `• ${parts.join(' / ')} — ${priceText}`;
}
