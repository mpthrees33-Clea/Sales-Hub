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

  // Explicit price/quote ask wins — even if a new project is mentioned, the
  // customer wants numbers.
  if (/\b(quote|pricing|price|cost|how much|estimate|rfp|bid)\b/.test(haystack)) {
    return 'pricing_request';
  }
  if (/\b(sample|swatch|chip|board)\b/.test(haystack)) {
    return 'sample_request';
  }
  // New-lead detection BEFORE spec/brochure check — a brochure ask paired
  // with a new-project mention is a new lead and should trigger the
  // budget-tier ask, not a generic "here's the catalog" reply.
  if (/\bnew\s+(?:\w+\s+){0,2}(project|build|development|opportunity|lead)\b|just\s+landed|just\s+bought|got\s+your\s+name/.test(haystack)) {
    return 'new_lead';
  }
  if (/\b(spec sheet|specifications?|technical data|cut sheet|leed|sustainability|warranty)\b/.test(haystack)) {
    return 'spec_sheet_request';
  }
  if (/\b(brochure|catalog|literature|product (guide|info|line))\b/.test(haystack)) {
    return 'spec_sheet_request';
  }
  if (/\b(lunch.{0,5}learn|presentation|come by|meeting|schedule|appointment|showroom visit|visit our|stop by)\b/.test(haystack)) {
    return 'scheduling';
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
// Follows the same VOICE rules as the LLM prompt: enthusiastic on positive
// news, never assume — always ask for missing specs by name.
function composeFallbackBody(args: {
  email: EmailMessage;
  rep: Rep;
  intent: EmailIntent;
  matchedProject?: ExtendedProject;
  brochures: Brochure[];
  attachBrochureIds: string[];
  missingFieldAsks?: MissingFieldAsk[];
}): string {
  const senderFirst = args.email.fromName.split(/\s+/)[0] || 'there';
  const repFirst = args.rep.name.split(/\s+/)[0];
  const projectClause = args.matchedProject ? ` on ${args.matchedProject.name}` : '';
  const attachedNames = args.attachBrochureIds
    .map((id) => args.brochures.find((b) => b.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const positive = isPositiveNews(args.email);

  let lead: string;
  switch (args.intent) {
    case 'pricing_request': {
      const openers = positive
        ? [`That's great news!`, `Awesome — happy to hear it.`, `Excellent.`]
        : [`Thanks for sending this over.`, `Got it.`];
      const opener = openers[0];

      const asks = composeMissingFieldQuestions(args.missingFieldAsks ?? []);
      if (asks) {
        lead = `${opener} I can absolutely put a quote together${projectClause}. Quick — ${asks} We can't quote what we don't know and I don't want to assume. Once I have that, the formal quote will follow.`;
      } else {
        lead = `${opener} I'll put the formal quote together${projectClause} and have it over to you shortly.`;
      }
      break;
    }
    case 'spec_sheet_request':
      lead = `Attached are the spec sheets you asked for${projectClause}. Let me know if you need anything else — additional product literature, comparison sheets, or LEED documentation.`;
      break;
    case 'sample_request':
      lead = `I'll get samples in the mail today${projectClause}. You should have them in 2–3 business days — let me know once they land and we can talk next steps.`;
      break;
    case 'scheduling':
      lead = `Happy to set that up${projectClause}. What days/times work best for you? I can usually offer a Tuesday or Thursday in the next couple weeks — let me know what fits.`;
      break;
    case 'new_lead': {
      const range = inferBudgetRangeBlurb(args.email);
      const budgetAsk = range
        ? `Quick question before I dive deeper — do you have a target budget? For ${range.label}, projects typically run ${range.range}. Knowing where you're aiming helps me narrow this down instead of sending the full line.`
        : `Quick question before I dive deeper — do you have a target budget for the project? Knowing where you're aiming helps me narrow recommendations instead of sending the full line.`;
      lead = `Great to hear from you${projectClause}. Trinity would love to be involved. I've attached our overview literature to get you started. ${budgetAsk}`;
      break;
    }
    case 'follow_up':
      lead = `Following up${projectClause} — happy to keep this moving. Where are you in the process and what specifically do you need from me next? Specs, samples, revised pricing, a call?`;
      break;
    case 'order_question':
      lead = `I'll pull up the order details and circle back today with status, tracking, and any next steps.`;
      break;
    default:
      lead = `Thanks for reaching out. Let me know exactly what you need and I'll get on it today.`;
  }

  const attachLine = attachedNames ? `\n\nAttached: ${attachedNames}.` : '';
  return `Hi ${senderFirst},\n\n${lead}${attachLine}\n\nThanks,\n${repFirst}`;
}

// Build a single natural-language sentence asking for each missing field by
// name. Used by the fallback composer so reps see specific asks instead of
// generic "let me know if anything changes" wording.
function composeMissingFieldQuestions(asks: MissingFieldAsk[]): string {
  if (!asks.length) return '';
  // Dedupe by contextLabel — multiple line items can share asks.
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const ask of asks) {
    const label = ask.contextLabel;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  // Cap at 5 for readability; the chip strip surfaces the full list.
  const capped = labels.slice(0, 5);
  if (capped.length === 1) return `do you know the ${capped[0]}?`;
  if (capped.length === 2) return `do you know the ${capped[0]} and the ${capped[1]}?`;
  const head = capped.slice(0, -1).join(', ');
  const tail = capped[capped.length - 1];
  return `do you have the ${head}, and the ${tail}?`;
}

// Detect "this email is positive/celebratory news" so the fallback opener
// matches the energy of the message. Conservative — we'd rather sound
// professional than fake enthusiasm on a neutral note.
function isPositiveNews(email: EmailMessage): boolean {
  const haystack = `${email.subject} ${email.body}`.toLowerCase();
  return /\b(approved|approval|got approval|great news|good news|love(s|d)?\s+(the|it|that)|loved the|moving forward|move forward|excited|congrats|won the|go ahead|green light)\b/.test(haystack);
}

// Rough budget anchor for new-lead asks. Looks for category mentions in the
// email + a quantity, returns a copy-pastable phrase like "18,000 sq ft of
// commercial LVP — $40k–$70k typical".
interface BudgetBlurb {
  label: string;
  range: string;
}
function inferBudgetRangeBlurb(email: EmailMessage): BudgetBlurb | undefined {
  const haystack = `${email.subject} ${email.body}`;
  const lower = haystack.toLowerCase();

  const qtyMatch = haystack.match(/([\d,]+)\s*(sq\s*ft|sqft|square\s+feet|sq\s*yd|square\s+yards|units)/i);
  const qty = qtyMatch ? parseFloat(qtyMatch[1].replace(/,/g, '')) : undefined;
  if (!qty || qty < 500) return undefined;

  const ranges: Array<{ test: RegExp; label: string; lo: number; hi: number; unit: 'sf' | 'sy' }> = [
    { test: /\b(spc|stone\s*polymer)\b/, label: 'commercial SPC',         lo: 2.80, hi: 4.00, unit: 'sf' },
    { test: /\b(lvp|luxury vinyl|vinyl plank)\b/, label: 'commercial LVP', lo: 2.20, hi: 3.50, unit: 'sf' },
    { test: /\b(carpet|broadloom)\b/, label: 'commercial carpet',          lo: 1.40, hi: 2.50, unit: 'sy' },
    { test: /\btile|porcelain|ceramic\b/, label: 'porcelain tile',         lo: 2.20, hi: 4.50, unit: 'sf' },
    { test: /\b(engineered hardwood|engineered wood)\b/, label: 'engineered hardwood', lo: 3.50, hi: 5.50, unit: 'sf' },
    { test: /\b(solid hardwood|maple|oak|walnut|cherry)\b/, label: 'solid hardwood',   lo: 4.50, hi: 7.00, unit: 'sf' },
    { test: /\b(laminate)\b/, label: 'laminate',                                       lo: 1.75, hi: 2.99, unit: 'sf' },
    { test: /\b(cork)\b/, label: 'cork',                                               lo: 2.40, hi: 3.50, unit: 'sf' },
  ];

  const matched = ranges.filter((r) => r.test.test(lower));
  if (!matched.length) return undefined;

  // Skip when matched categories mix units (sq ft vs sq yd) — the qty in the
  // email is one unit, so a combined projection would be misleading. Better
  // to fall through to the no-anchor budget ask than print bad numbers.
  const units = new Set(matched.map((m) => m.unit));
  if (units.size > 1) return undefined;

  const lo = Math.min(...matched.map((m) => m.lo));
  const hi = Math.max(...matched.map((m) => m.hi));
  const totalLo = Math.round((qty * lo) / 1000);
  const totalHi = Math.round((qty * hi) / 1000);
  const labels = matched.map((m) => m.label).slice(0, 2).join(' / ');
  const qtyLabel = qty.toLocaleString();
  const unitText = matched[0].unit === 'sy' ? 'sq yd' : 'sq ft';
  return {
    label: `${qtyLabel} ${unitText} of ${labels}`,
    range: `$${totalLo}k–$${totalHi}k`,
  };
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

  const systemPrompt = `You are ${ctx.rep.name}, a sales rep at Trinity Surfaces — a Georgia-based flooring distributor. You draft replies to incoming customer emails.

VOICE
- Warm, direct, confident, professional. You sound like a senior rep who knows the line cold and respects the customer's time.
- Be enthusiastic when the news is genuinely positive ("That's great news!", "Awesome — glad they like it.", "Love hearing that."). Don't fake it on neutral emails.
- 3–6 short sentences. End with a sign-off using your first name.
- Use Trinity product names unless the customer named a competitor brand first.

THE GOLDEN RULE — NEVER ASSUME, ALWAYS ASK
A quote is only as good as the inputs. If anything is missing — color, size, finish, qty, project name, architectural firm, GC, developer, end user, job location, or budget tier — name it specifically and ask for it before you commit to a quote. You can write that you'll send a quote once you have the info; you cannot send a quote you'd have to fudge.

EXAMPLES (good vs bad asks)
✓ "Do you know which color they chose so I can lock that in on the quote?"
✓ "Quick question — what finish are they thinking? Embossed and polished change the pricing tier, so I want to make sure I send you the right number."
✓ "Do you have a target budget for the project? Knowing what we're shooting for helps me narrow this down instead of sending the full line."
✗ "Let me know if anything changes." (too soft)
✗ "I'll work up the numbers." (commits to a quote we can't actually write)
✗ "Send updated specs whenever you have them." (passive)

BUDGET TIER REFERENCE (for context — use rough ranges only when the customer hasn't stated a budget)
- Commercial LVP: ~$2.20–$3.50 / sq ft
- Commercial SPC: ~$2.80–$4.00 / sq ft
- Commercial carpet: ~$1.40–$2.50 / sq yd
- Porcelain tile: ~$2.20–$4.50 / sq ft
- Engineered hardwood: ~$3.50–$5.50 / sq ft
- Solid hardwood: ~$4.50–$7.00 / sq ft
- Cork: ~$2.40–$3.50 / sq ft
- Laminate: ~$1.75–$2.99 / sq ft

OUTPUT — VALID JSON ONLY, matching this exact shape:
{"intent": "pricing_request|spec_sheet_request|general_inquiry|scheduling|new_lead|follow_up|sample_request|order_question|other",
 "subject": "Re: ...",
 "body": "Hi X,\\n\\n...",
 "attachBrochureIds": ["b1"],
 "lineItemRequests": [{"productName": "BlueSky SPC", "size": "9x60", "color": null, "finish": "embossed", "quantity": 8200, "unit": "sq ft"}],
 "missingFieldAsks": [{"field": "color", "contextLabel": "color for BlueSky SPC", "hint": "..."}],
 "reasoning": "one line"}

GENERAL RULES
- Subject: "Re: <original subject>" unless it already starts with Re:, then keep as-is.
- Body: real, sendable text. No placeholders, no bracketed instructions to the reader, no headers like "Body:". Do not write "[your name]" — sign with your actual first name.
- attachBrochureIds: pick from the catalog below. Empty array if no attachment is warranted. Max 3.

FOR pricing_request:
- Extract every line item the customer is asking about into lineItemRequests. Use the Trinity name when you can map the requested brand/product to one. Fill in size, color, finish, quantity (and unit — "sq ft", "sq yd", "carton", "each") when stated. Use null for any field the email doesn't specify — DO NOT guess.
- For missingFieldAsks: list every field you still need to write a formal quote. field is one of: project_name, architectural_firm, gc, developer, end_user, job_location, product, size, color, finish, quantity. contextLabel is human-readable (e.g. "color for BlueSky SPC"). hint can quote what the customer said to give the rep context.
- Body must (in order):
    1. Open enthusiastically if the news is positive (sample approval, going to bid, "love it" — anything that's a win). Otherwise warm + direct.
    2. For EVERY field in missingFieldAsks, ask for it BY NAME in a single natural sentence. Don't lump them as "anything else you have"; the customer needs to know exactly what's needed. E.g.: "Do you know which color they chose so I can add it to your quote? We can't quote what we don't know."
    3. Promise the formal quote follows once you have the info. The quote table is generated separately — DO NOT include pricing numbers in the body.

FOR new_lead and general_inquiry:
- If the customer hasn't given you a budget tier or project value, ASK about budget. Phrase like: "Do you have a target budget? Knowing the range helps me narrow this down instead of sending the full line." When relevant, drop a rough range from the BUDGET TIER REFERENCE above so the customer has anchor numbers.
- Attach 1–2 relevant brochures from the catalog.

FOR spec_sheet_request:
- Attach the matching brochures from the catalog. Body confirms what's attached and offers to send more if needed.

FOR sample_request, scheduling, follow_up, order_question:
- lineItemRequests and missingFieldAsks should be [] or omitted.
- Sample/order: no attachments. Scheduling: confirm + offer 2–3 specific times when possible.`;

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

  // Compute missing fields BEFORE composing body so the fallback writer can
  // ask for each one by name in the reply (matches the LLM path behavior).
  let lineItemRequests: LineItemRequest[] | undefined;
  let missingFieldAsks: MissingFieldAsk[] | undefined;
  if (intent === 'pricing_request') {
    lineItemRequests = extractLineItemsLocally(ctx.email, ctx.products);
    missingFieldAsks = deriveMaterialMissingFields(lineItemRequests);
  }

  const body = composeFallbackBody({
    email: ctx.email,
    rep: ctx.rep,
    intent,
    matchedProject: ctx.matchedProject,
    brochures: ctx.brochures,
    attachBrochureIds,
    missingFieldAsks,
  });

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
