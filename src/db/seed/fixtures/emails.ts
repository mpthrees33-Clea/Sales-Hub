/**
 * Hand-written email fixtures (docs/04 §2): the 14 unprocessed Monday
 * inbound emails mapped to triage categories, and Cole's ~30-message sent
 * corpus (the tone source for the style profile). Every SKU, person, project,
 * price, and quote number referenced here exists in the DB — enforced by the
 * seed consistency check.
 */
import { skuOf } from "../data/catalog";
import { PO_CLEAN_NUMBER, PO_MISMATCH_NUMBER, QUOTE_1042_NUMBER } from "../scenario";

export type InboundEmailFixture = {
  key: string;
  /** Sender: seeded contact (accountKey+contactName) or raw address for noise. */
  accountKey?: string;
  contactName?: string;
  fromRaw?: string;
  subject: string;
  body: string;
  /** Monday receive time, ET wall clock "HH:MM". */
  receivedEt: string;
  /** Expected triage category (docs/04 §2 mapping — asserted in tests). */
  category:
    | "quote_request"
    | "stock_check"
    | "po"
    | "sample_request"
    | "submittal_request"
    | "scheduling"
    | "general"
    | "noise";
  attachments?: { name: string; blobKey: string; contentType: string }[];
  /** Structured references for the consistency check. */
  refs: { skus?: string[]; quotes?: string[]; projects?: string[]; meetings?: string[] };
};

const S = {
  walnut: skuOf("Walnut Grain"),
  whiteOak: skuOf("White Oak"),
  stormGrey: skuOf("Storm Grey"),
  brushedSteel: skuOf("Brushed Steel"),
  travertine: skuOf("Travertine"),
  sage: skuOf("Sage"),
  ebony: skuOf("Ebony"),
  gunmetal: skuOf("Gunmetal"),
  carrara: skuOf("Carrara Marble"),
  cork: skuOf("Natural Cork"),
  teak: skuOf("Teak"),
  slate: skuOf("Slate"),
  charcoal: skuOf("Charcoal"),
  terracotta: skuOf("Terracotta"),
  boucle: skuOf("Boucle Cloud"),
  champagne: skuOf("Champagne Gold"),
  leather: skuOf("Leather Grain"),
  rattan: skuOf("Rattan"),
  matteWhite: skuOf("Matte White"),
  neroMarquina: skuOf("Nero Marquina"),
};

export const INBOUND_MONDAY: InboundEmailFixture[] = [
  // 1–2: quote requests (docs/04 §2.1)
  {
    key: "in-quote-stonebridge",
    accountKey: "gc-stonebridge",
    contactName: "Marcus Hale",
    subject: "Meridian Tower 12F — pricing for three finishes",
    receivedEt: "08:12",
    category: "quote_request",
    body: `Cole,

We're locking the 12th floor finish schedule this week. Can you price the following for the Meridian Tower 12th Floor TI:

- White Oak (${S.whiteOak}) — 28 rolls, elevator lobby + feature walls
- Storm Grey (${S.stormGrey}) — 40 rolls, corridor wainscot
- Brushed Steel (${S.brushedSteel}) — 12 rolls, column wraps

Need pricing and current lead times. If anything's short we may phase the install, so give me what you can ship now vs later.

Thanks,
Marcus Hale
Stonebridge Construction Group`,
    refs: { skus: [S.whiteOak, S.stormGrey, S.brushedSteel], projects: ["Meridian Tower 12th Floor TI"] },
  },
  {
    key: "in-quote-crestline",
    accountKey: "gc-crestline",
    contactName: "Priya Nair",
    subject: "Juniper Hotel — corridor finish pricing",
    receivedEt: "09:47",
    category: "quote_request",
    body: `Hi Cole,

For the Juniper Hotel Raleigh corridors we're carrying two of your finishes in the current set:

- Travertine (${S.travertine}) — 22 rolls
- Sage (${S.sage}) — 35 rolls

Could you send over a quote? Owner wants updated numbers before Friday's OAC.

Priya Nair
Crestline Builders — Preconstruction`,
    refs: { skus: [S.travertine, S.sage], projects: ["Juniper Hotel Raleigh"] },
  },

  // 3–4: stock checks (docs/04 §2.2)
  {
    key: "in-stock-piedmont",
    accountKey: "di-piedmont",
    contactName: "Dana Whitfield",
    subject: "Availability check — four SKUs",
    receivedEt: "10:05",
    category: "stock_check",
    body: `Cole —

Before I finalize our next stock buy, what's on-hand and lead time for:

${S.ebony} (Ebony)
${S.gunmetal} (Gunmetal)
${S.carrara} (Carrara Marble)
${S.cork} (Natural Cork)

Customer projects are asking and I don't want to promise what you can't ship.

Dana
Piedmont Surface Distribution`,
    refs: { skus: [S.ebony, S.gunmetal, S.carrara, S.cork] },
  },
  {
    key: "in-stock-carolina",
    accountKey: "di-carolina",
    contactName: "Evan Ross",
    subject: "Lead times on wood + stone lines",
    receivedEt: "11:30",
    category: "stock_check",
    body: `Cole,

Quick availability check ahead of a PO we're cutting: Teak (${S.teak}), Slate (${S.slate}), Charcoal (${S.charcoal}), and Terracotta (${S.terracotta}). On-hand and lead time on each?

Evan Ross
Carolina Architectural Products`,
    refs: { skus: [S.teak, S.slate, S.charcoal, S.terracotta] },
  },

  // 5–6: POs with PDFs (docs/04 §2.3)
  {
    key: "in-po-carolina",
    accountKey: "di-carolina",
    contactName: "Evan Ross",
    subject: `PO ${PO_CLEAN_NUMBER} — stock order`,
    receivedEt: "13:21",
    category: "po",
    body: `Cole,

PO attached for the stock order we discussed — three lines, ship to our Raleigh warehouse. Confirm receipt and expected ship.

Evan
Carolina Architectural Products`,
    attachments: [{ name: `${PO_CLEAN_NUMBER}.pdf`, blobKey: `po/${PO_CLEAN_NUMBER}.pdf`, contentType: "application/pdf" }],
    refs: { skus: [] },
  },
  {
    key: "in-po-piedmont",
    accountKey: "di-piedmont",
    contactName: "Dana Whitfield",
    subject: `PO ${PO_MISMATCH_NUMBER} against quote ${QUOTE_1042_NUMBER}`,
    receivedEt: "16:58",
    category: "po",
    body: `Cole —

Here's our PO against quote ${QUOTE_1042_NUMBER}. Five lines as quoted. Get it into the system and let me know ship timing on the wood grains first.

Dana
Piedmont Surface Distribution`,
    attachments: [
      { name: `${PO_MISMATCH_NUMBER}.pdf`, blobKey: `po/${PO_MISMATCH_NUMBER}.pdf`, contentType: "application/pdf" },
    ],
    refs: { quotes: [QUOTE_1042_NUMBER] },
  },

  // 7–8: sample requests (docs/04 §2.4)
  {
    key: "in-sample-atelier",
    accountKey: "ds-ateliernorth",
    contactName: "Sofia Marino",
    subject: "Samples — Walnut Grain + two others",
    receivedEt: "09:15",
    category: "sample_request",
    body: `Hi Cole,

For a client presentation next week could you send 8x10 samples of:

- Walnut Grain (${S.walnut})
- Boucle Cloud (${S.boucle})
- Champagne Gold (${S.champagne})

Ship to the studio, attention me. Excited to see the walnut in person — the photos look great.

Sofia Marino
Atelier North Design`,
    refs: { skus: [S.walnut, S.boucle, S.champagne] },
  },
  {
    key: "in-sample-fostervale",
    accountKey: "ds-fostervale",
    contactName: "Jordan Ellery",
    subject: "Full-sheet samples for a hospitality board",
    receivedEt: "14:42",
    category: "sample_request",
    body: `Cole,

Building a materials board for a hospitality pitch — can you send full sheets of Leather Grain (${S.leather}) and Rattan (${S.rattan})? Two of each if you can spare them.

Jordan
Foster & Vale Interiors`,
    refs: { skus: [S.leather, S.rattan] },
  },

  // 9: submittal request (docs/04 §2.5)
  {
    key: "in-submittal-whitaker",
    accountKey: "gc-whitaker",
    contactName: "Ray Delgado",
    subject: "Harborview Medical Ph2 — submittal package needed",
    receivedEt: "15:36",
    category: "submittal_request",
    body: `Cole,

Architect is asking for the submittal package on the interior film scope for Harborview Medical Phase 2. Need product data sheets, install guides, and fire test reports for:

- Walnut Grain (${S.walnut})
- Matte White (${S.matteWhite})
- Brushed Steel (${S.brushedSteel})

Sooner is better — we're trying to close out submittals by end of next week. Sample sets for the architect would help too.

Ray Delgado
Whitaker Commercial Contractors`,
    refs: { skus: [S.walnut, S.matteWhite, S.brushedSteel], projects: ["Harborview Medical Phase 2"] },
  },

  // 10: scheduling (docs/04 §2.6 — touches today's docket)
  {
    key: "in-sched-atelier",
    accountKey: "ds-ateliernorth",
    contactName: "Grace Lin",
    subject: "Tomorrow 3:00 — push to 3:30?",
    receivedEt: "17:20",
    category: "scheduling",
    body: `Hi Cole,

Sofia's 2:00 client call is running long tomorrow — could we push your 3:00 presentation at the studio to 3:30? Same conference room. Sorry for the shuffle!

Grace Lin
Atelier North Design`,
    refs: { meetings: ["Atelier North — spring line presentation"] },
  },

  // 11: general / technical (docs/04 §2.7)
  {
    key: "in-tech-calder",
    accountKey: "ar-calder",
    contactName: "Ben Osei",
    subject: "Fire rating — Nero Marquina in a healthcare corridor",
    receivedEt: "11:58",
    category: "general",
    body: `Cole,

Spec question: we're considering Nero Marquina (${S.neroMarquina}) for a healthcare corridor application. Can you confirm the flame spread classification per ASTM E84, and whether you have the test report on file? Need it for the life-safety narrative.

Ben Osei
Calder Design Partners`,
    refs: { skus: [S.neroMarquina] },
  },

  // 12–14: noise (docs/04 §2.8)
  {
    key: "in-noise-buildwire",
    fromRaw: "newsletter@buildwire-weekly.example.net",
    subject: "BuildWire Weekly: 10 trends reshaping commercial interiors",
    receivedEt: "07:42",
    category: "noise",
    body: `This week in BuildWire: adaptive reuse is up 14%, mass timber keeps winning, and the 10 interior trends every GC should watch. Read the full issue online. You are receiving this because you subscribed to BuildWire Weekly. Unsubscribe anytime.`,
    refs: {},
  },
  {
    key: "in-noise-webinar",
    fromRaw: "events@adhesivetech-summit.example.net",
    subject: "[Webinar] Solvent-free adhesives — last chance to register",
    receivedEt: "12:33",
    category: "noise",
    body: `Final call! Join 2,000+ professionals for our free webinar on next-gen solvent-free adhesive systems. Thursday 1 PM ET. Register now — seats are limited. AdhesiveTech Summit — this is a promotional message.`,
    refs: {},
  },
  {
    key: "in-noise-suppliercon",
    fromRaw: "promo@suppliercon.example.net",
    subject: "SupplierCon 2026 early-bird pricing ends Friday",
    receivedEt: "15:02",
    category: "noise",
    body: `SupplierCon 2026 — the building products industry's biggest week. Early-bird passes end Friday. Network with 8,000 distributors and manufacturers in Orlando. Book your booth today. Promotional message from SupplierCon.`,
    refs: {},
  },
];

// ── Sent corpus: ~30 outbound messages in Cole's voice (docs/04 §2) ──────────

export type SentEmailFixture = {
  key: string;
  accountKey: string;
  contactName: string;
  subject: string;
  body: string;
  /** Days before demo-now the message was sent (weekday-ish spread). */
  daysAgo: number;
  sentEtTime: string; // "HH:MM"
  refs: { skus?: string[]; quotes?: string[]; projects?: string[] };
};

function sig(): string {
  return "—Cole";
}

export const SENT_CORPUS: SentEmailFixture[] = [
  {
    key: "out-q1042",
    accountKey: "di-piedmont",
    contactName: "Dana Whitfield",
    subject: `Quote ${QUOTE_1042_NUMBER} — Q1 stock buy`,
    daysAgo: 5,
    sentEtTime: "09:40",
    body: `Dana,

Quote ${QUOTE_1042_NUMBER} is attached — all five lines at your distributor pricing, wood grains included. Walnut Grain (${S.walnut}) is healthy on stock right now, so if you cut the PO this week I can ship the wood first and the rest behind it.

Valid 30 days. I'll get the updated sell-through numbers over to you before lunch Tuesday.

${sig()}`,
    refs: { quotes: [QUOTE_1042_NUMBER], skus: [S.walnut] },
  },
  {
    key: "out-harborview-prewalk",
    accountKey: "gc-whitaker",
    contactName: "Ray Delgado",
    subject: "Monday's walk — what I'm bringing",
    daysAgo: 4,
    sentEtTime: "16:05",
    body: `Ray,

Set for Monday 2:00 at Harborview. I'll bring Walnut Grain (${S.walnut}) and Matte White (${S.matteWhite}) samples for the corridor decision, plus the fire-rating one-pager your life-safety guy asked about.

If the schedule moves, just text me.

${sig()}`,
    refs: { skus: [S.walnut, S.matteWhite], projects: ["Harborview Medical Phase 2"] },
  },
  {
    key: "out-crestline-leadtime",
    accountKey: "gc-crestline",
    contactName: "Priya Nair",
    subject: "Travertine lead time",
    daysAgo: 8,
    sentEtTime: "08:55",
    body: `Priya,

Travertine (${S.travertine}) is running about two weeks right now — I'd get quantities locked before the owner meeting so we hold that window. Sage (${S.sage}) is on the shelf.

I'll get the corridor quote over to you as soon as your set lands.

${sig()}`,
    refs: { skus: [S.travertine, S.sage] },
  },
];

const TEMPLATE_TARGETS: { accountKey: string; contactName: string; product: string }[] = [
  { accountKey: "di-tristate", contactName: "Walt Griggs", product: "Rift Oak" },
  { accountKey: "di-metrolina", contactName: "Ana Cabrera", product: "Pewter" },
  { accountKey: "di-capital", contactName: "Reid Palmer", product: "Limestone" },
  { accountKey: "di-gatecity", contactName: "Faye Holt", product: "Birch" },
  { accountKey: "di-southern", contactName: "Leo Marsh", product: "Titanium" },
  { accountKey: "di-eastfork", contactName: "June Park", product: "Basalt" },
  { accountKey: "ar-merrow", contactName: "Lauren Tate", product: "Smoked Oak" },
  { accountKey: "ds-fostervale", contactName: "Jordan Ellery", product: "Raw Silk" },
  { accountKey: "ds-halcyon", contactName: "Nina Brandt", product: "Blush Clay" },
  { accountKey: "ar-fieldstone", contactName: "Drew Calloway", product: "Concrete Cast" },
  { accountKey: "ow-pinnacle", contactName: "Marco Reyes", product: "Antique Brass" },
  { accountKey: "ow-cardinal", contactName: "Beth Nolan", product: "Ash Grey" },
  { accountKey: "ds-ateliernorth", contactName: "Sofia Marino", product: "Boucle Cloud" },
  { accountKey: "ar-calder", contactName: "Ben Osei", product: "Carrara Marble" },
  { accountKey: "gc-keystone", contactName: "Miles Overton", product: "Deep Navy" },
  { accountKey: "gc-redoak", contactName: "Imani Wells", product: "Maple" },
  { accountKey: "gc-hartwell", contactName: "Owen Pierce", product: "Hickory" },
  { accountKey: "di-piedmont", contactName: "Chris Yoder", product: "Zebrano" },
  { accountKey: "gc-summitpark", contactName: "Elise Tran", product: "Sandstone" },
  { accountKey: "ow-crownridge", contactName: "Ivy Chen", product: "Onyx Smoke" },
  { accountKey: "gc-truenorth", contactName: "Caleb Munn", product: "Felt Grey" },
  { accountKey: "ar-northloop", contactName: "Gil Ferris", product: "Hammered Relief" },
  { accountKey: "ds-vantage", contactName: "Kayla Dunn", product: "Natural Cork" },
  { accountKey: "ow-oakcity", contactName: "Wendy Salazar", product: "Matte White" },
  { accountKey: "gc-ironhill", contactName: "Victor Ames", product: "Corten Weathered" },
  { accountKey: "ow-lakemont", contactName: "Tess Marlow", product: "Ivory" },
  { accountKey: "ow-stateline", contactName: "Rob Tatum", product: "Slate" },
];

const TEMPLATES: ((first: string, product: string, sku: string, lead: number) => { subject: string; body: string })[] =
  [
    (first, product, sku, lead) => ({
      subject: `${product} samples on the way`,
      body: `${first},

Your ${product} (${sku}) samples went out today — you should have them in two days. Lead time on full rolls is about ${lead} days right now if the board goes your way.

Anything else you want in the box next time, just say the word.

${sig()}`,
    }),
    (first, product, sku, lead) => ({
      subject: `Re: ${product} availability`,
      body: `${first},

Good news — ${product} (${sku}) is on the shelf, about ${lead} days door to door. I'll get the spec sheet over to you this afternoon so you have it for the set.

${sig()}`,
    }),
    (first, product, sku) => ({
      subject: `Spec sheet — ${product}`,
      body: `${first},

Attached the product data sheet for ${product} (${sku}) — Class A fire rating and the install notes your team asked about. If it helps, I can swing by with the physical sample next week.

${sig()}`,
    }),
    (first, product, sku, lead) => ({
      subject: `Following up from Tuesday`,
      body: `${first},

Good seeing you Tuesday. Recapping: I'll hold ${product} (${sku}) pricing through end of month, and lead time is ${lead} days as of today. Send quantities whenever the schedule firms up and I'll turn the quote same day.

${sig()}`,
    }),
  ];

export function buildTemplatedSent(): SentEmailFixture[] {
  const out: SentEmailFixture[] = [];
  TEMPLATE_TARGETS.forEach((t, i) => {
    const sku = skuOf(t.product);
    const tpl = TEMPLATES[i % TEMPLATES.length]!;
    const first = t.contactName.split(" ")[0]!;
    const lead = 7 + (i % 11);
    const { subject, body } = tpl(first, t.product, sku, lead);
    out.push({
      key: `out-tpl-${t.accountKey}-${i}`,
      accountKey: t.accountKey,
      contactName: t.contactName,
      subject,
      body,
      daysAgo: 6 + ((i * 3) % 38),
      sentEtTime: ["08:20", "09:35", "11:10", "13:45", "15:25", "16:40"][i % 6]!,
      refs: { skus: [sku] },
    });
  });
  return out;
}

export const ALL_SENT: SentEmailFixture[] = [...SENT_CORPUS, ...buildTemplatedSent()];
