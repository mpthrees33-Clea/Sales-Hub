import type {
  EmailMessage, EmailIntent, EmailDraft, Brochure,
  Project, ProjectExtensions, Customer, Rep, Product,
  MissingFieldAsk, QuoteMissingField,
} from '../types';
import type { LineItemRequest } from './pricing';

// Email AI pipeline. Takes a received email + the rep's context and produces
// an auto-drafted reply. Uses Gemini when configured; falls back to a
// deterministic template engine so the page works without an API key.
//
// One LLM call per draft (classify + compose together) to be friendly to
// Gemini Flash rate limits. Caching is handled by the caller — this module
// is pure(ish): it reads context, returns a draft, never writes to the store.

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export function isEmailAIConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

type ExtendedProject = Project & ProjectExtensions;

export interface DraftGenerationContext {
  email: EmailMessage;
  rep: Rep;
  matchedProject?: ExtendedProject;
  matchedCustomer?: Customer;
  brochures: Brochure[];
  products: Product[];
}

export interface DraftGenerationResult {
  intent: EmailIntent;
  subject: string;
  body: string;
  attachBrochureIds: string[];
  reasoning?: string;
  // Populated only for pricing_request intent. Orchestrator runs these
  // through the pricing engine to build the quote scaffold.
  lineItemRequests?: LineItemRequest[];
  // Material-level missing fields. Project-level asks are computed in the
  // orchestrator (it knows which project fields are filled).
  missingFieldAsks?: MissingFieldAsk[];
}

// ── Deterministic intent classifier (fallback + pre-LLM signal) ──
// Cheap regex-based classifier. Catches obvious cases without an LLM call.
// When Gemini is configured the LLM gets the final say, but this guides the
// fallback path and provides a sanity check.
export function classifyIntentLocally(email: EmailMessage): EmailIntent {
  const haystack = `${email.subject} ${email.body}`.toLowerCase();

  if (/\b(quote|pricing|price|cost|how much|budget|estimate|rfp|bid)\b/.test(haystack)) {
    return 'pricing_request';
  }
  if (/\b(spec sheet|specifications?|technical data|cut sheet|leed|sustainability|warranty)\b/.test(haystack)) {
    return 'spec_sheet_request';
  }
  if (/\b(brochure|catalog|literature|product (guide|info|line))\b/.test(haystack)) {
    return 'spec_sheet_request';
  }
  if (/\b(sample|swatch|chip|board)\b/.test(haystack)) {
    return 'sample_request';
  }
  if (/\b(lunch.{0,5}learn|presentation|come by|meeting|schedule|appointment|showroom visit|visit our|stop by)\b/.test(haystack)) {
    return 'scheduling';
  }
  if (/\b(new project|new build|new development|just landed|just bought|got your name|new lead)\b/.test(haystack)) {
    return 'new_lead';
  }
  if (/^re:/i.test(email.subject) || /\b(following up|circling back|update|status|where (are|do) we|just checking)\b/.test(haystack)) {
    return 'follow_up';
  }
  if (/\b(order|tracking|po|invoice|delivery)\b/.test(haystack)) {
    return 'order_question';
  }
  return 'general_inquiry';
}

// ── Brochure auto-attach (deterministic) ──
// Match brochures to the email based on intent + product mentions. Used by
// both the LLM path (LLM may suggest IDs; we validate against this list as
// a guardrail) and the fallback path.
export function suggestBrochures(
  email: EmailMessage,
  intent: EmailIntent,
  context: { brochures: Brochure[]; products: Product[]; matchedProject?: ExtendedProject },
): string[] {
  const haystack = `${email.subject} ${email.body}`.toLowerCase();
  const picks = new Set<string>();

  // Sample requests and order questions don't need brochures.
  if (intent === 'sample_request' || intent === 'order_question') return [];

  // 1. Brochures for products the project already uses.
  if (context.matchedProject) {
    for (const pid of context.matchedProject.productIds) {
      const product = context.products.find((p) => p.id === pid);
      product?.brochureIds.forEach((bid) => picks.add(bid));
    }
  }

  // 2. Brochures whose product list overlaps a product mentioned in the email.
  for (const product of context.products) {
    const names = [
      product.trinityName.toLowerCase(),
      product.trinitySku.toLowerCase(),
      ...product.privateLabels.map((pl) => pl.productName.toLowerCase()),
      ...product.privateLabels.map((pl) => pl.brand.toLowerCase()),
    ];
    if (names.some((n) => haystack.includes(n))) {
      product.brochureIds.forEach((bid) => picks.add(bid));
    }
  }

  // 3. Category mentions.
  const categoryMentions: Array<[RegExp, string]> = [
    [/\b(lvp|spc|vinyl plank|luxury vinyl)\b/i, 'LVP'],
    [/\b(carpet)\b/i, 'Carpet'],
    [/\b(tile|porcelain|ceramic)\b/i, 'Tile'],
    [/\b(hardwood|oak|maple|walnut)\b/i, 'Hardwood'],
    [/\b(laminate)\b/i, 'Laminate'],
    [/\b(cork)\b/i, 'Cork'],
    [/\b(commercial)\b/i, 'Commercial'],
    [/\b(leed|green|sustainab)\w*/i, 'Sustainability'],
  ];
  for (const [re, label] of categoryMentions) {
    if (!re.test(haystack)) continue;
    for (const b of context.brochures) {
      if (b.category.toLowerCase().includes(label.toLowerCase())) picks.add(b.id);
      if (b.tags.some((t) => t.toLowerCase().includes(label.toLowerCase()))) picks.add(b.id);
    }
  }

  // Cap at 3 to keep replies tidy.
  return Array.from(picks).slice(0, 3);
}

// ── Deterministic body composer (fallback) ──
// Used when Gemini isn't configured or fails. Produces a plausible reply
// from the intent + context so the page still works in offline/no-key mode.
function composeFallbackBody(args: {
  email: EmailMessage;
  rep: Rep;
  intent: EmailIntent;
  matchedProject?: ExtendedProject;
  brochures: Brochure[];
  attachBrochureIds: string[];
}): string {
  const senderFirst = args.email.fromName.split(/\s+/)[0] || 'there';
  const repFirst = args.rep.name.split(/\s+/)[0];
  const projectClause = args.matchedProject ? ` on ${args.matchedProject.name}` : '';
  const attachedNames = args.attachBrochureIds
    .map((id) => args.brochures.find((b) => b.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  let lead: string;
  switch (args.intent) {
    case 'pricing_request':
      lead = `Thanks for the pricing request${projectClause}. I'll work up the numbers and have a formal quote over within 24 hours. If you have any updates on the specs (size, color, finish, qty) before then, just send them along.`;
      break;
    case 'spec_sheet_request':
      lead = `Attached are the spec sheets you asked for${projectClause}. Let me know if you need anything else — additional product literature, comparison sheets, or LEED documentation.`;
      break;
    case 'sample_request':
      lead = `I'll get samples in the mail today${projectClause}. You should have them in 2–3 business days. Let me know once they land and we can talk next steps.`;
      break;
    case 'scheduling':
      lead = `Happy to set that up${projectClause}. Let me know what days/times work for you and I'll get something on the calendar.`;
      break;
    case 'new_lead':
      lead = `Great to hear from you. Trinity would love to be involved in this — I've attached our overview literature to get you started. Want to set up a quick call to walk through your specs and timeline?`;
      break;
    case 'follow_up':
      lead = `Following up — happy to keep moving this forward${projectClause}. Where are you in the process and what do you need from me next?`;
      break;
    case 'order_question':
      lead = `I'll pull up the order details and get back to you with status today.`;
      break;
    default:
      lead = `Thanks for reaching out. Let me know what you need and I'll get on it.`;
  }

  const attachLine = attachedNames ? `\n\nAttached: ${attachedNames}.` : '';

  return `Hi ${senderFirst},\n\n${lead}${attachLine}\n\nThanks,\n${repFirst}`;
}

// ── LLM-backed composer ──
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 700,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
}

function trimContext<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

function buildBrochureCatalogText(brochures: Brochure[]): string {
  return brochures
    .map((b) => `- ${b.id} | ${b.name} | brand: ${b.brand} | cat: ${b.category} | tags: ${b.tags.join(', ')}`)
    .join('\n');
}

// Run the LLM-backed draft generator. Returns the structured result. Caller
// handles persistence + fallback on error.
export async function generateDraftWithLLM(
  ctx: DraftGenerationContext,
  signal?: AbortSignal,
): Promise<DraftGenerationResult> {
  if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY not configured');

  const localIntent = classifyIntentLocally(ctx.email);

  const projectBlob = ctx.matchedProject
    ? `Matched project: ${JSON.stringify({
        name: ctx.matchedProject.name,
        type: ctx.matchedProject.projectType,
        stage: ctx.matchedProject.opportunityStage,
        location: ctx.matchedProject.jobLocation,
        nextStep: ctx.matchedProject.nextStep,
        value: ctx.matchedProject.value,
        productIds: ctx.matchedProject.productIds,
      })}`
    : 'No matched project — sender may be referring to a new opportunity or a general inquiry.';

  const systemPrompt = `You are ${ctx.rep.name}, a sales rep at Trinity Surfaces — a Georgia-based flooring distributor. You draft replies to incoming customer emails. Tone: warm, concise, professional, to-the-point. Replies are typically 3–6 short sentences. End with a sign-off using your first name.

Trinity sells LVP, SPC, hardwood, engineered hardwood, laminate, carpet, tile, cork, and bamboo. Every product has both a Trinity name and 2+ competitor/brand private-label names — use Trinity names in replies unless the customer used a brand name first.

You will receive: the incoming email, project context (if matched), and a brochure catalog. You must output VALID JSON only, matching this exact shape:
{"intent": "pricing_request|spec_sheet_request|general_inquiry|scheduling|new_lead|follow_up|sample_request|order_question|other",
 "subject": "Re: ...",
 "body": "Hi X,\\n\\n...",
 "attachBrochureIds": ["b1"],
 "lineItemRequests": [{"productName": "BlueSky SPC", "size": "9x60", "color": null, "finish": "embossed", "quantity": 8200, "unit": "sq ft"}],
 "missingFieldAsks": [{"field": "color", "contextLabel": "color for BlueSky SPC", "hint": "..."}],
 "reasoning": "one line"}

Rules:
- Subject: "Re: <original subject>" unless it already starts with Re:, then keep as-is.
- Body: real, sendable text. No placeholders, no bracketed instructions to the reader, no headers like "Body:".
- attachBrochureIds: pick from the catalog below. Empty array if no attachment is warranted. Max 3.

For pricing_request specifically:
- Extract every line item the customer is asking about into lineItemRequests. Use the Trinity name when you can map the requested brand/product to one. Fill in size, color, finish, quantity (and unit — "sq ft", "sq yd", "carton", "each") when stated. Use null for any field the email doesn't specify — DO NOT guess.
- For missingFieldAsks: list every field you still need to write a formal quote. field is one of: project_name, architectural_firm, gc, developer, end_user, job_location, product, size, color, finish, quantity. contextLabel is human-readable (e.g. "color for BlueSky SPC"). hint can quote what the customer said to give the rep context.
- Body should:
    * Confirm receipt and acknowledge the project.
    * If missingFieldAsks is non-empty, list the missing items naturally as a single sentence ("I just need X, Y, and Z to put this together").
    * Promise the formal quote follows (it will be auto-attached by the system).
    * NOT include any pricing numbers — the quote table is generated separately.

For non-pricing intents:
- lineItemRequests and missingFieldAsks should be [] or omitted.
- For spec sheet requests, attach the matching brochures from the catalog.
- For new leads, attach 1–2 overview brochures.
- For order questions, no attachments.`;

  const userPrompt = `Incoming email:
From: ${ctx.email.fromName} <${ctx.email.from}>
Subject: ${ctx.email.subject}
Body:
${ctx.email.body}

Sender context: ${ctx.matchedCustomer ? `Known customer — ${ctx.matchedCustomer.company} (${ctx.matchedCustomer.type})` : 'Sender is not in CRM.'}
${projectBlob}
Local intent guess: ${localIntent}

Brochure catalog (id | name | brand | category | tags):
${buildBrochureCatalogText(trimContext(ctx.brochures, 25))}

Draft the reply. Return JSON only.`;

  const raw = await callGemini(systemPrompt, userPrompt, signal);
  return parseLLMJSON(raw, ctx);
}

function parseLLMJSON(raw: string, ctx: DraftGenerationContext): DraftGenerationResult {
  // The model is asked for JSON. Strip any code fences before parsing.
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Gemini returned non-JSON: ${trimmed.slice(0, 200)}`);
  }

  const intent: EmailIntent = ALLOWED_INTENTS.has(parsed.intent) ? parsed.intent : classifyIntentLocally(ctx.email);
  const subject: string = typeof parsed.subject === 'string' && parsed.subject.trim()
    ? parsed.subject.trim()
    : (/^re:/i.test(ctx.email.subject) ? ctx.email.subject : `Re: ${ctx.email.subject}`);
  const body: string = typeof parsed.body === 'string' && parsed.body.trim()
    ? parsed.body.trim()
    : composeFallbackBody({ email: ctx.email, rep: ctx.rep, intent, matchedProject: ctx.matchedProject, brochures: ctx.brochures, attachBrochureIds: [] });

  // Validate brochure IDs against the catalog so the LLM can't hallucinate.
  const validIds = new Set(ctx.brochures.map((b) => b.id));
  const llmIds = Array.isArray(parsed.attachBrochureIds)
    ? parsed.attachBrochureIds.filter((id: unknown) => typeof id === 'string' && validIds.has(id))
    : [];
  const attachBrochureIds: string[] = llmIds.slice(0, 3);

  const lineItemRequests = parseLineItemRequests(parsed.lineItemRequests);
  const missingFieldAsks = parseMissingFieldAsks(parsed.missingFieldAsks);

  return {
    intent,
    subject,
    body,
    attachBrochureIds,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
    lineItemRequests: lineItemRequests.length ? lineItemRequests : undefined,
    missingFieldAsks: missingFieldAsks.length ? missingFieldAsks : undefined,
  };
}

function parseLineItemRequests(raw: unknown): LineItemRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: LineItemRequest[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const productName = typeof (r as any).productName === 'string' ? (r as any).productName.trim() : '';
    if (!productName) continue;
    out.push({
      productName,
      size: stringOrUndef((r as any).size),
      color: stringOrUndef((r as any).color),
      finish: stringOrUndef((r as any).finish),
      quantity: numberOrUndef((r as any).quantity),
      unit: stringOrUndef((r as any).unit),
    });
  }
  return out;
}

const ALLOWED_MISSING_FIELDS = new Set<QuoteMissingField>([
  'project_name', 'architectural_firm', 'gc', 'developer', 'end_user',
  'job_location', 'product', 'size', 'color', 'finish', 'quantity',
]);

function parseMissingFieldAsks(raw: unknown): MissingFieldAsk[] {
  if (!Array.isArray(raw)) return [];
  const out: MissingFieldAsk[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const field = (r as any).field;
    if (!ALLOWED_MISSING_FIELDS.has(field)) continue;
    const contextLabel = typeof (r as any).contextLabel === 'string'
      ? (r as any).contextLabel.trim()
      : field.replace(/_/g, ' ');
    out.push({
      field,
      contextLabel,
      hint: stringOrUndef((r as any).hint),
    });
  }
  return out;
}

function stringOrUndef(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'tbd' || s.toLowerCase() === 'unknown') return undefined;
  return s;
}

function numberOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && isFinite(v) && v > 0) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s]/g, '');
    const n = parseFloat(cleaned);
    if (isFinite(n) && n > 0) return n;
  }
  return undefined;
}

const ALLOWED_INTENTS = new Set<EmailIntent>([
  'pricing_request', 'spec_sheet_request', 'general_inquiry',
  'scheduling', 'new_lead', 'follow_up', 'dormant_reply',
  'sample_request', 'order_question', 'other',
]);

// ── Deterministic line-item + missing-field extractor (fallback) ──

// Regex-based extractor for pricing_request emails. Used when Gemini isn't
// configured. Best-effort — pulls qty/size/finish from the full email,
// matches against known product names. The pricing engine handles whatever
// is unknown via [PLACEHOLDER] markers.
export function extractLineItemsLocally(
  email: EmailMessage,
  products: Product[],
): LineItemRequest[] {
  const haystack = `${email.subject} ${email.body}`;
  const lower = haystack.toLowerCase();
  const items: LineItemRequest[] = [];

  const qtyMatch = haystack.match(/([\d,]+)\s*(sq\s*ft|sqft|square\s+feet|sq\s*yd|square\s+yards|sq\.\s*ft|units)/i);
  const quantity = qtyMatch ? parseFloat(qtyMatch[1].replace(/,/g, '')) : undefined;
  const unit = qtyMatch
    ? /sq\s*yd|square\s+yards/i.test(qtyMatch[2]) ? 'sq yd'
    : /units/i.test(qtyMatch[2]) ? 'each'
    : 'sq ft'
    : undefined;

  const sizeMatch = haystack.match(/(\d+(?:\.\d+)?)\s*["']?\s*x\s*(\d+(?:\.\d+)?)\s*["']?/);
  const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : undefined;

  const finishOptions = [
    'embossed', 'polished', 'matte', 'satin',
    'hand-scraped', 'wire-brushed', 'honed', 'distressed', 'lacquer',
  ];
  const finish = finishOptions.find((f) => lower.includes(f));

  for (const product of products) {
    const names = [
      product.trinityName.toLowerCase(),
      product.trinitySku.toLowerCase(),
      ...product.privateLabels.map((pl) => pl.productName.toLowerCase()),
    ];
    if (names.some((n) => lower.includes(n))) {
      items.push({
        productName: product.trinityName,
        productId: product.id,
        size,
        finish,
        quantity,
        unit: unit ?? product.unit,
      });
    }
  }

  // If the rep is asking about pricing but didn't name a product, emit a
  // placeholder so the quote table still surfaces the missing-product field.
  if (items.length === 0) {
    items.push({ productName: 'Product TBD', size, finish, quantity, unit });
  }

  return items;
}

// Derive material-level missing-field asks from extracted line items.
// Project-level asks (architect/GC/developer/etc.) are added by the
// orchestrator based on the matched Project record.
export function deriveMaterialMissingFields(
  lineItemRequests: LineItemRequest[],
): MissingFieldAsk[] {
  const out: MissingFieldAsk[] = [];
  for (const li of lineItemRequests) {
    if (!li.productName || li.productName === 'Product TBD') {
      out.push({ field: 'product', contextLabel: 'product (which Trinity line)', hint: 'Customer asked for pricing without naming a product.' });
    }
    if (!li.size) {
      out.push({ field: 'size', contextLabel: `size${li.productName ? ' for ' + li.productName : ''}` });
    }
    if (!li.color) {
      out.push({ field: 'color', contextLabel: `color${li.productName ? ' for ' + li.productName : ''}` });
    }
    if (!li.finish) {
      out.push({ field: 'finish', contextLabel: `finish${li.productName ? ' for ' + li.productName : ''}` });
    }
    if (!li.quantity) {
      out.push({ field: 'quantity', contextLabel: `qty${li.productName ? ' for ' + li.productName : ''}` });
    }
  }
  return out;
}

// ── Top-level entrypoint ──
// Call this with a received email + context; get back a fully-formed draft
// scaffold ready to persist as an EmailDraft. Falls back to deterministic
// composition when Gemini isn't configured or fails.
export async function buildDraftScaffold(
  ctx: DraftGenerationContext,
  signal?: AbortSignal,
): Promise<DraftGenerationResult> {
  if (isEmailAIConfigured()) {
    try {
      return await generateDraftWithLLM(ctx, signal);
    } catch (err) {
      console.warn('Email AI fell back to deterministic composer:', err);
      // fall through
    }
  }

  // Deterministic path.
  const intent = classifyIntentLocally(ctx.email);
  const attachBrochureIds = suggestBrochures(ctx.email, intent, {
    brochures: ctx.brochures,
    products: ctx.products,
    matchedProject: ctx.matchedProject,
  });
  const subject = /^re:/i.test(ctx.email.subject) ? ctx.email.subject : `Re: ${ctx.email.subject}`;
  const body = composeFallbackBody({
    email: ctx.email,
    rep: ctx.rep,
    intent,
    matchedProject: ctx.matchedProject,
    brochures: ctx.brochures,
    attachBrochureIds,
  });

  let lineItemRequests: LineItemRequest[] | undefined;
  let missingFieldAsks: MissingFieldAsk[] | undefined;
  if (intent === 'pricing_request') {
    lineItemRequests = extractLineItemsLocally(ctx.email, ctx.products);
    missingFieldAsks = deriveMaterialMissingFields(lineItemRequests);
  }

  return {
    intent,
    subject,
    body,
    attachBrochureIds,
    reasoning: 'deterministic fallback',
    lineItemRequests,
    missingFieldAsks,
  };
}
