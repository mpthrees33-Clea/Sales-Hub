import { useAppStore } from '../store/useAppStore';
import type { SampleOrder, Customer, CustomerContact, Rep } from '../types';

// ── Sample-delivery follow-up rule ──────────────────────────────
// Business rule: every time a sample order is delivered, the next morning
// there should be a drafted follow-up email to whoever received it. The
// rep wakes up to a ready-to-send draft in the Drafts folder, fills any
// gaps, and ships it.
//
// Implementation:
//   1. SampleOrder.deliveredAt is stamped by updateSampleOrder() the first
//      time status flips to 'Delivered'.
//   2. generateSampleFollowUps() sweeps on app mount (and again whenever
//      Email page mounts as a safety net) and creates a follow-up draft
//      for any delivered order that:
//        a. has deliveredAt set
//        b. crossed the "morning after" threshold (>= 12h since delivery)
//        c. hasn't already been followed up (followUpDraftEmailId unset)
//   3. The draft is created as a regular EmailMessage in the 'drafts'
//      folder so it shows up alongside other drafts. followUpDraftEmailId
//      back-links the draft to the sample order for idempotency.
//
// LLM is optional — if VITE_GEMINI_API_KEY is set, we try a Gemini-polished
// draft; otherwise (or on failure) we use a deterministic template.

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// "Morning after" = at least 12 hours after delivery. In demo state where
// the rep flips an order to Delivered just to test, they'll see the draft
// appear after the next page load past that 12h window.
const FOLLOW_UP_THRESHOLD_MS = 12 * 60 * 60 * 1000;

interface FollowUpInputs {
  order: SampleOrder;
  customer: Customer;
  contact: CustomerContact | undefined;
  rep: Rep | undefined;
}

function deterministicBody({ order, customer, contact, rep }: FollowUpInputs): string {
  const greetingName = contact?.name.split(/\s+/)[0] ?? customer.name.split(/\s+/)[0] ?? 'there';
  const repName = rep?.name ?? 'Colton Plante';
  const repFirst = repName.split(/\s+/)[0];
  const itemBullets = order.items
    .map((i) => `  • ${i.quantity}× ${i.productName}${i.privateLabelName ? ` (${i.privateLabelName})` : ''}`)
    .join('\n');
  const itemCount = order.items.length;
  return [
    `Hi ${greetingName},`,
    '',
    `Just following up — the ${itemCount === 1 ? 'sample' : 'samples'} we sent over should have landed yesterday. Quick recap of what was in the box:`,
    itemBullets,
    '',
    'A few things I\'d love to hear from you:',
    '  • What did you (or the team) think of the look and feel in person?',
    '  • Is this tracking for a specific project or spec — anything I can help you nail down (size, finish, color)?',
    '  • Are there any other Trinity products you\'d like me to send over for comparison?',
    '',
    'Happy to pull pricing, send over a brochure, or set up a quick walkthrough whenever you\'re ready. Just say the word.',
    '',
    'Thanks,',
    repFirst,
  ].join('\n');
}

function deterministicSubject({ order, customer }: FollowUpInputs): string {
  const firstItem = order.items[0];
  if (!firstItem) return `Following up on your samples — ${customer.company}`;
  return `Following up on your ${firstItem.productName} ${order.items.length > 1 ? `+ ${order.items.length - 1} other sample${order.items.length - 1 === 1 ? '' : 's'}` : 'sample'}`;
}

async function llmPolish(inputs: FollowUpInputs): Promise<{ subject: string; body: string } | null> {
  if (!GEMINI_API_KEY) return null;
  const { order, customer, contact, rep } = inputs;
  const systemPrompt = `You are ${rep?.name ?? 'Colton Plante'}, a sales rep at Trinity Surfaces — a Georgia-based flooring distributor. You are writing a follow-up email the morning after a customer received physical samples you shipped.

VOICE
- Warm, direct, confident. 3–6 short sentences. End with your first name.
- Ask SPECIFIC questions about the samples: did they like the look/feel, any team feedback, target project, color/size/finish lock-in.
- Offer concrete next steps: pricing, brochures, comparison samples, a quick walkthrough.
- DO NOT promise pricing without confirming color/finish/size/qty — that's the Golden Rule.

OUTPUT FORMAT — JSON ONLY
{
  "subject": "string — concise, references the sample line item",
  "body": "string — multi-line email body, signed with rep's first name"
}`;
  const userPrompt = `Sample order context:
- Customer: ${customer.company} (${customer.type})
- Recipient contact: ${contact?.name ?? customer.name}${contact?.title ? ` (${contact.title})` : ''}
- Delivered: ${order.deliveredAt?.slice(0, 10) ?? 'yesterday'}
- Items in box:
${order.items.map((i) => `  - ${i.quantity}× ${i.productName}${i.privateLabelName ? ` (${i.privateLabelName})` : ''}`).join('\n')}

Write the follow-up. Return JSON only.`;
  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    const parsed = JSON.parse(raw);
    if (typeof parsed?.subject !== 'string' || typeof parsed?.body !== 'string') return null;
    return { subject: parsed.subject, body: parsed.body };
  } catch {
    return null;
  }
}

function resolveRecipientEmail({ contact, customer, order }: FollowUpInputs): string {
  return contact?.email ?? customer.email ?? `${order.shippingName.replace(/\s+/g, '.').toLowerCase()}@unknown`;
}

// Generate any pending sample follow-up drafts. Idempotent — safe to call
// on every app mount and every Email page mount.
export async function generateSampleFollowUps(): Promise<number> {
  const state = useAppStore.getState();
  const now = Date.now();
  const pending = state.sampleOrders.filter((o) => {
    if (o.status !== 'Delivered') return false;
    if (!o.deliveredAt) return false;
    if (o.followUpDraftEmailId) return false;
    const delivMs = Date.parse(o.deliveredAt);
    if (Number.isNaN(delivMs)) return false;
    return now - delivMs >= FOLLOW_UP_THRESHOLD_MS;
  });

  if (pending.length === 0) return 0;

  let created = 0;
  for (const order of pending) {
    const customer = state.customers.find((c) => c.id === order.customerId);
    if (!customer) continue;
    const contact = order.contactId
      ? customer.contacts.find((c) => c.id === order.contactId)
      : customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];
    const rep = state.reps.find((r) => r.id === state.currentRepId);
    const inputs: FollowUpInputs = { order, customer, contact, rep };

    let subject: string;
    let body: string;
    const polished = await llmPolish(inputs);
    if (polished) {
      subject = polished.subject;
      body = polished.body;
    } else {
      subject = deterministicSubject(inputs);
      body = deterministicBody(inputs);
    }

    const toEmail = resolveRecipientEmail(inputs);
    const draftId = `e-followup-${order.id}-${now}`;
    state.addEmail({
      id: draftId,
      from: rep?.email ?? 'colton@trinitysurfaces.com',
      fromName: rep?.name ?? 'Colton P.',
      to: [toEmail],
      subject,
      body,
      date: new Date().toISOString(),
      isRead: false,
      isStarred: false,
      folder: 'drafts',
      attachedBrochureIds: [],
    });
    state.updateSampleOrder(order.id, { followUpDraftEmailId: draftId });
    created += 1;
  }
  return created;
}
