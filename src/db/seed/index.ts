/**
 * The deterministic seed engine (docs/04, WO-01 task 11). Idempotent
 * truncate+reinsert with stable ids (sid); blob fixtures uploaded once and
 * reused. `pnpm seed --reset-day` is the film-day reset: because every id and
 * row is deterministic, a full reseed IS the reset — demo clock back to Tue
 * 6:55 AM, Monday batch unprocessed, all post-baseline runs/approvals gone,
 * 8-week history byte-identical.
 *
 * Dev fixture flags: --with-overnight (WO-02), --with-approvals (WO-03).
 */
import "@/lib/load-env";
import { sql } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import {
  accountPriceLists,
  accounts,
  activities,
  assets,
  contacts,
  demoState,
  emails,
  emailThreads,
  inventory,
  invoices,
  meetings,
  opportunities,
  pdsDocuments,
  priceListItems,
  priceLists,
  products,
  projects,
  quotes,
  roomScenes,
  salesOrders,
  sampleOrders,
  targets,
  transcripts,
  type QuoteLine,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { blobExists, putBlob } from "@/lib/blob";
import { REP } from "@/lib/rep";
import { invalidateDemoClockCache } from "@/lib/demo-clock";
import { invalidateAllowlistCache } from "@/harness/policy-gate";
import { ACCOUNTS, accountByKey, contactOf } from "./data/accounts";
import { CATALOG, HERO, tierPriceCents } from "./data/catalog";
import { HISTORY, PO_CLEAN, PO_MISMATCH, Q1042_LINES, linesSubtotal } from "./data/commerce";
import { FILLER_OPPORTUNITY_ACCOUNTS, fillerOpportunity, MEETINGS, OPPORTUNITIES, PROJECTS } from "./data/crm";
import { ALL_SENT, INBOUND_MONDAY } from "./fixtures/emails";
import { HARBORVIEW_TRANSCRIPT } from "./fixtures/transcript";
import { makeMeetingWav } from "./fixtures/audio";
import { makePoPdf, makeProductDocPdf } from "./fixtures/pdf";
import { compositeSceneSvg } from "@/providers/imagegen/demo";
import { roomPhotoSvg, swatchSvg } from "./fixtures/swatch";
import { runConsistencyCheck } from "./consistency";
import { sid, shash } from "./ids";
import {
  DEMO_NOW,
  et,
  MONDAY,
  QUOTE_1041_NUMBER,
  QUOTE_1042_NUMBER,
  SCENARIO_VERSION,
  TARGET_CREATED_MONTH_CENTS,
  TARGET_CREATED_WEEK_CENTS,
  TARGET_INVOICED_MONTH_CENTS,
  TARGET_INVOICED_WEEK_CENTS,
} from "./scenario";

export type SeedFlags = {
  resetDay?: boolean;
  withOvernight?: boolean;
  withApprovals?: boolean;
};

/**
 * The full deterministic rebuild — truncate + reseed IS the film-day reset
 * (identical ids/history every run). Importable in-process (demo-control's
 * reset-day, tests); never closes the shared pool — the CLI wrapper does.
 */
export async function runSeed(FLAGS: SeedFlags = {}): Promise<{ ok: boolean; elapsedMs: number }> {
  const t0 = Date.now();
  console.log(`[seed] scenario ${SCENARIO_VERSION}${FLAGS.resetDay ? " (reset-day)" : ""}`);

  await truncateAll();
  await seedDemoState();
  await seedAccounts();
  await seedCatalog();
  await seedCrm();
  await seedQuotes();
  await seedHistory();
  await seedMeetings();
  await seedEmails();
  await seedScenes();
  await seedSampleOrders();
  await seedMarketingAssets();
  await seedTargets();

  invalidateDemoClockCache();
  invalidateAllowlistCache();

  await audit({
    actor: "system",
    action: FLAGS.resetDay ? "demo.reset_day" : "demo.seeded",
    detail: { scenario: SCENARIO_VERSION },
  });

  const check = await runConsistencyCheck(db);
  if (!check.ok) {
    console.error("[seed] CONSISTENCY CHECK FAILED — fixtures reference entities missing from the DB:");
    for (const m of check.misses) console.error(`  · ${m}`);
    return { ok: false, elapsedMs: Date.now() - t0 };
  }
  console.log("[seed] consistency check passed");

  if (FLAGS.withOvernight) {
    const { seedOvernightFixtures } = await import("./fixtures/overnight-runs");
    await seedOvernightFixtures();
    console.log("[seed] --with-overnight fixtures inserted");
  }
  if (FLAGS.withApprovals) {
    const { seedApprovalFixtures } = await import("./fixtures/approvals");
    await seedApprovalFixtures();
    console.log("[seed] --with-approvals fixtures inserted");
  }

  console.log(`[seed] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { ok: true, elapsedMs: Date.now() - t0 };
}

async function truncateAll() {
  await db.execute(sql`
    TRUNCATE TABLE
      audit_log, agent_steps, agent_runs, approvals, triage_routings,
      style_profiles, morning_briefs, routes_cache, activities, transcripts,
      meetings, invoices, sales_orders, purchase_orders, quotes,
      sample_orders, submittal_packages, room_scenes, presentations, assets,
      pds_documents, price_list_items, account_price_lists, price_lists,
      inventory, emails, email_threads, opportunities, projects, contacts,
      accounts, products, targets, demo_state
    CASCADE
  `);
}

async function seedDemoState() {
  await db.insert(demoState).values({
    id: 1,
    demoNow: DEMO_NOW,
    lastNightlyRunAt: null,
    scenarioVersion: SCENARIO_VERSION,
    showDemoChip: true,
  });
}

async function seedAccounts() {
  await db.insert(accounts).values(
    ACCOUNTS.map((a) => ({
      id: sid(`account:${a.key}`),
      name: a.name,
      type: a.type,
      address: a.address,
      lat: a.lat,
      lng: a.lng,
      tier: a.tier,
      creditLimitCents: a.type === "distributor" ? 40_000_000 : 25_000_000,
    })),
  );
  await db.insert(contacts).values(
    ACCOUNTS.flatMap((a) =>
      a.contacts.map((c) => ({
        id: sid(`contact:${a.key}:${c.name}`),
        accountId: sid(`account:${a.key}`),
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: c.role,
      })),
    ),
  );
}

async function seedCatalog() {
  await db.insert(products).values(
    CATALOG.map((c) => ({
      id: sid(`product:${c.sku}`),
      sku: c.sku,
      name: c.name,
      family: c.family,
      finish: c.finish,
      description: c.description,
      swatchBlobUrl: `/api/blob/swatches/${c.sku}.svg`,
      unit: c.unit,
      spec: {
        thicknessMm: 0.3,
        widthMm: 1220,
        fireRating: c.fireRating,
        adhesive: "Acrylic PSA, air-egress liner",
        rollLengthM: 50,
      },
    })),
  );

  // Swatch blobs (skipped when already uploaded).
  for (const c of CATALOG) {
    const key = `swatches/${c.sku}.svg`;
    if (!(await blobExists(key))) {
      await putBlob(key, swatchSvg(c), { contentType: "image/svg+xml" });
    }
  }

  // Inventory — scenario overrides make the demo beats deterministic:
  // White Oak short (split-shipment beat), Walnut Grain healthy (hero).
  const OVERRIDES: Record<string, { onHand: number; allocated: number; leadTimeDays: number }> = {
    "White Oak": { onHand: 15, allocated: 3, leadTimeDays: 12 },
    "Walnut Grain": { onHand: 64, allocated: 6, leadTimeDays: 7 },
    "Storm Grey": { onHand: 88, allocated: 0, leadTimeDays: 6 },
    "Brushed Steel": { onHand: 40, allocated: 4, leadTimeDays: 9 },
  };
  await db.insert(inventory).values(
    CATALOG.map((c) => {
      const o = OVERRIDES[c.name];
      return {
        id: sid(`inventory:${c.sku}`),
        productId: sid(`product:${c.sku}`),
        onHand: o?.onHand ?? c.onHand,
        allocated: o?.allocated ?? shash(`alloc:${c.sku}`, 6),
        leadTimeDays: o?.leadTimeDays ?? c.leadTimeDays,
        restockAt: null,
      };
    }),
  );

  // Price lists — three tiers.
  const tiers = [
    { key: "list", name: "Standard List", tier: "list" as const },
    { key: "distributor", name: "Distributor Program", tier: "distributor" as const },
    { key: "project", name: "Project Pricing", tier: "project" as const },
  ];
  await db.insert(priceLists).values(tiers.map((t) => ({ id: sid(`pricelist:${t.key}`), name: t.name, tier: t.tier })));
  await db.insert(priceListItems).values(
    tiers.flatMap((t) =>
      CATALOG.map((c) => ({
        id: sid(`pli:${t.key}:${c.sku}`),
        priceListId: sid(`pricelist:${t.key}`),
        productId: sid(`product:${c.sku}`),
        unitPriceCents: tierPriceCents(c.listPriceCents, t.tier),
        minQty: c.minQty,
      })),
    ),
  );
  await db.insert(accountPriceLists).values(
    ACCOUNTS.map((a) => ({
      id: sid(`apl:${a.key}`),
      accountId: sid(`account:${a.key}`),
      priceListId: sid(`pricelist:${a.tier}`),
    })),
  );

  // Product documents: 4 generated PDFs per SKU.
  const kinds = ["pds", "install", "test_report", "warranty"] as const;
  const titles: Record<(typeof kinds)[number], string> = {
    pds: "Product Data Sheet",
    install: "Installation Guide",
    test_report: "ASTM E84 Test Report",
    warranty: "Limited Warranty",
  };
  const docRows: (typeof pdsDocuments.$inferInsert)[] = [];
  for (const c of CATALOG) {
    for (const kind of kinds) {
      const key = `docs/${c.sku}-${kind}.pdf`;
      if (!(await blobExists(key))) {
        const bytes = await makeProductDocPdf(c, kind);
        await putBlob(key, Buffer.from(bytes), { contentType: "application/pdf" });
      }
      docRows.push({
        id: sid(`pds:${c.sku}:${kind}`),
        productId: sid(`product:${c.sku}`),
        kind,
        title: `${c.name} — ${titles[kind]}`,
        blobUrl: `/api/blob/${key}`,
        pages: 1,
      });
    }
  }
  await db.insert(pdsDocuments).values(docRows);
  console.log(`[seed] catalog: ${CATALOG.length} SKUs, ${docRows.length} documents`);
}

async function seedCrm() {
  await db.insert(projects).values(
    PROJECTS.map((p) => {
      const acct = accountByKey(p.accountKey);
      return {
        id: sid(`project:${p.key}`),
        accountId: sid(`account:${p.accountKey}`),
        name: p.name,
        segment: p.segment,
        stage: "active",
        address: acct.address,
        lat: acct.lat + 0.004,
        lng: acct.lng - 0.003,
        gcName: p.gcName,
        architectName: p.architectName,
      };
    }),
  );

  const q1042Value = linesSubtotal(Q1042_LINES);
  const all = [
    ...OPPORTUNITIES.map((o) => (o.key === "opp-piedmont-q1042" ? { ...o, valueCents: q1042Value } : o)),
    ...FILLER_OPPORTUNITY_ACCOUNTS.map((k) => fillerOpportunity(k)),
  ];
  await db.insert(opportunities).values(
    all.map((o) => ({
      id: sid(`opportunity:${o.key}`),
      projectId: o.projectKey ? sid(`project:${o.projectKey}`) : null,
      accountId: sid(`account:${o.accountKey}`),
      name: o.name,
      stage: o.stage,
      valueCents: o.valueCents,
      probability: o.probability,
      expectedClose: o.expectedClose,
      nextStep: o.nextStep,
      lastActivityAt: et(`2026-03-0${1 + shash(`lastact:${o.key}`, 7)}T15:00` as `${number}-${number}-${number}T${number}:${number}`),
    })),
  );
  console.log(`[seed] crm: ${PROJECTS.length} projects, ${all.length} opportunities`);
}

async function seedQuotes() {
  const mkLines = (lines: typeof Q1042_LINES, tierKey: string): QuoteLine[] =>
    lines.map((l) => ({
      productId: sid(`product:${l.sku}`),
      sku: l.sku,
      description: `${l.name} architectural film`,
      qty: l.qty,
      uom: "roll",
      unitPriceCents: l.unitPriceCents,
      extendedCents: l.qty * l.unitPriceCents,
      leadTimeDays: 10,
      sourceRowId: sid(`pli:${tierKey}:${l.sku}`),
    }));

  const subtotal1042 = linesSubtotal(Q1042_LINES);
  await db.insert(quotes).values([
    {
      id: sid(`quote:${QUOTE_1042_NUMBER}`),
      accountId: sid("account:di-piedmont"),
      opportunityId: sid("opportunity:opp-piedmont-q1042"),
      number: QUOTE_1042_NUMBER,
      status: "sent",
      lines: mkLines(Q1042_LINES, "distributor"),
      subtotalCents: subtotal1042,
      totalCents: subtotal1042,
      validUntil: "2026-04-04",
      createdAt: et("2026-03-05T09:40"),
    },
    {
      id: sid(`quote:${QUOTE_1041_NUMBER}`),
      accountId: sid("account:gc-redoak"),
      opportunityId: sid("opportunity:opp-redoak-med"),
      number: QUOTE_1041_NUMBER,
      status: "sent",
      lines: mkLines(
        [
          { sku: CATALOG[4]!.sku, name: CATALOG[4]!.name, qty: 14, unitPriceCents: tierPriceCents(CATALOG[4]!.listPriceCents, "project") },
        ],
        "project",
      ),
      subtotalCents: 14 * tierPriceCents(CATALOG[4]!.listPriceCents, "project"),
      totalCents: 14 * tierPriceCents(CATALOG[4]!.listPriceCents, "project"),
      validUntil: "2026-03-28",
      createdAt: et("2026-03-03T14:10"),
    },
  ]);
}

async function seedHistory() {
  let soSeq = 2001;
  let invSeq = 4901;
  const soRows: (typeof salesOrders.$inferInsert)[] = [];
  const invRows: (typeof invoices.$inferInsert)[] = [];
  for (const h of HISTORY) {
    const day = new Date(new Date(`${h.weekMonday}T00:00:00-05:00`).getTime() + h.dayOffset * 86_400_000);
    const at = new Date(day.getTime() + (10 + (shash(`hour:${h.key}`, 6))) * 3_600_000);
    if (h.invoice) {
      invRows.push({
        id: sid(`invoice:${h.key}`),
        salesOrderId: null,
        number: `INV-${invSeq++}`,
        amountCents: h.totalCents,
        issuedAt: at,
        paidAt: shash(`paid:${h.key}`, 3) > 0 ? new Date(at.getTime() + 12 * 86_400_000) : null,
        createdAt: at,
      });
    } else {
      soRows.push({
        id: sid(`so:${h.key}`),
        accountId: sid(`account:${h.accountKey}`),
        number: `SO-${soSeq++}`,
        lines: h.lines.map((l) => ({
          productId: sid(`product:${l.sku}`),
          sku: l.sku,
          description: `${l.name} architectural film`,
          qty: l.qty,
          uom: "roll",
          unitPriceCents: l.unitPriceCents,
          extendedCents: l.qty * l.unitPriceCents,
        })),
        subtotalCents: h.totalCents,
        totalCents: h.totalCents,
        status: "confirmed",
        createdAt: at,
      });
    }
  }
  await db.insert(salesOrders).values(soRows);
  await db.insert(invoices).values(invRows);
  console.log(`[seed] history: ${soRows.length} sales orders, ${invRows.length} invoices`);
}

async function seedMeetings() {
  await db.insert(meetings).values(
    MEETINGS.map((m) => {
      const acct = accountByKey(m.accountKey);
      return {
        id: sid(`meeting:${m.key}`),
        title: m.title,
        accountId: sid(`account:${m.accountKey}`),
        projectId: m.projectKey ? sid(`project:${m.projectKey}`) : null,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        location: m.location,
        lat: acct.lat + 0.006,
        lng: acct.lng + 0.004,
        prepNotes: m.prepNotes,
        status: m.status,
      };
    }),
  );

  // Audio + transcript fixtures for the Harborview walk.
  const audioKey = "fixtures/harborview-walk.wav";
  if (!(await blobExists(audioKey))) {
    await putBlob(audioKey, makeMeetingWav(), { contentType: "audio/wav" });
  }
  const transcriptKey = "fixtures/transcript-harborview.json";
  if (!(await blobExists(transcriptKey))) {
    await putBlob(transcriptKey, JSON.stringify({ segments: HARBORVIEW_TRANSCRIPT }, null, 2), {
      contentType: "application/json",
    });
  }
  await db.insert(transcripts).values({
    id: sid("transcript:harborview"),
    meetingId: sid("meeting:mtg-harborview-walk"),
    audioBlobUrl: `/api/blob/${audioKey}`,
    segments: HARBORVIEW_TRANSCRIPT,
    summary: null, // the meeting pipeline fills summary/action items
    actionItems: null,
  });

  // Monday's meetings as activities.
  await db.insert(activities).values(
    MEETINGS.filter((m) => m.status === "completed").map((m) => ({
      id: sid(`activity:meeting:${m.key}`),
      type: "meeting" as const,
      accountId: sid(`account:${m.accountKey}`),
      refType: "meeting",
      refId: sid(`meeting:${m.key}`),
      summary: `Meeting: ${m.title}`,
      occurredAt: m.endsAt,
    })),
  );
}

async function seedEmails() {
  // PO PDF fixtures + grounded extraction JSONs + checksum manifest.
  const { createHash } = await import("node:crypto");
  const manifest: Record<string, string> = {};
  for (const po of [PO_MISMATCH, PO_CLEAN]) {
    const acct = accountByKey(po.accountKey);
    const buyer = po.accountKey === "di-piedmont" ? contactOf("di-piedmont", "Dana Whitfield") : contactOf("di-carolina", "Evan Ross");
    const { bytes, extraction } = await makePoPdf({
      number: po.number,
      poDate: po.poDate,
      company: acct.name,
      companyAddress: acct.address,
      buyer: { name: buyer.name, email: buyer.email, phone: buyer.phone },
      referencedQuote: po.referencedQuote,
      terms: po.terms,
      lines: po.lines,
    });
    const pdfKey = `po/${po.number}.pdf`;
    await putBlob(pdfKey, Buffer.from(bytes), { contentType: "application/pdf" });
    const extractKey = `fixtures/po-extract-${po.number}.json`;
    await putBlob(extractKey, JSON.stringify(extraction, null, 2), { contentType: "application/json" });
    manifest[createHash("sha256").update(Buffer.from(bytes)).digest("hex")] = extractKey;
  }
  await putBlob("fixtures/po-extract-manifest.json", JSON.stringify(manifest, null, 2), {
    contentType: "application/json",
  });

  // Inbound Monday batch.
  const threadRows: (typeof emailThreads.$inferInsert)[] = [];
  const emailRows: (typeof emails.$inferInsert)[] = [];
  for (const f of INBOUND_MONDAY) {
    const from = f.fromRaw ?? contactOf(f.accountKey!, f.contactName!).email;
    const receivedAt = et(`${MONDAY}T${f.receivedEt}` as `${number}-${number}-${number}T${number}:${number}`);
    const threadId = sid(`thread:${f.key}`);
    threadRows.push({
      id: threadId,
      subject: f.subject,
      participants: [from, REP.email],
      lastMessageAt: receivedAt,
      status: "active",
      createdAt: receivedAt,
    });
    emailRows.push({
      id: sid(`email:${f.key}`),
      threadId,
      direction: "inbound",
      fromEmail: from,
      toEmails: [REP.email],
      ccEmails: [],
      subject: f.subject,
      bodyText: f.body,
      receivedAt,
      attachments: (f.attachments ?? []).map((a) => ({
        name: a.name,
        contentType: a.contentType,
        blobKey: a.blobKey,
        sizeBytes: 40_000,
      })),
      isProcessed: false,
      createdAt: receivedAt,
    });
  }

  // Sent corpus.
  for (const f of ALL_SENT) {
    const to = contactOf(f.accountKey, f.contactName).email;
    const day = new Date(DEMO_NOW.getTime() - f.daysAgo * 86_400_000);
    const iso = day.toISOString().slice(0, 10);
    const sentAt = et(`${iso}T${f.sentEtTime}` as `${number}-${number}-${number}T${number}:${number}`);
    const threadId = sid(`thread:${f.key}`);
    threadRows.push({
      id: threadId,
      subject: f.subject,
      participants: [REP.email, to],
      lastMessageAt: sentAt,
      status: "active",
      createdAt: sentAt,
    });
    emailRows.push({
      id: sid(`email:${f.key}`),
      threadId,
      direction: "outbound",
      fromEmail: REP.email,
      toEmails: [to],
      ccEmails: [],
      subject: f.subject,
      bodyText: f.body,
      receivedAt: sentAt,
      attachments: [],
      isProcessed: true,
      createdAt: sentAt,
    });
  }

  await db.insert(emailThreads).values(threadRows);
  await db.insert(emails).values(emailRows);
  console.log(`[seed] email: ${INBOUND_MONDAY.length} staged inbound, ${ALL_SENT.length} sent corpus`);
}

async function seedScenes() {
  const lobbyKey = "rooms/lobby.svg";
  const confKey = "rooms/conference.svg";
  if (!(await blobExists(lobbyKey))) await putBlob(lobbyKey, roomPhotoSvg("lobby"), { contentType: "image/svg+xml" });
  if (!(await blobExists(confKey)))
    await putBlob(confKey, roomPhotoSvg("conference"), { contentType: "image/svg+xml" });

  const heroSceneKey = "scenes/hero-walnut-lobby.svg";
  if (!(await blobExists(heroSceneKey))) {
    await putBlob(heroSceneKey, compositeSceneSvg(HERO.swatchColor, "feature wall, reception desk"), {
      contentType: "image/svg+xml",
    });
  }
  const steel = CATALOG.find((c) => c.name === "Brushed Steel")!;
  const confSceneKey = "scenes/hero-steel-conference.svg";
  if (!(await blobExists(confSceneKey))) {
    await putBlob(confSceneKey, compositeSceneSvg(steel.swatchColor, "end wall"), { contentType: "image/svg+xml" });
  }

  await db.insert(roomScenes).values([
    {
      id: sid("scene:hero-walnut-lobby"),
      productId: sid(`product:${HERO.sku}`),
      sourcePhotoBlobUrl: `/api/blob/${lobbyKey}`,
      outputBlobUrl: `/api/blob/${heroSceneKey}`,
      prompt:
        "Apply this walnut wood-grain architectural film (first reference image) to the feature wall and reception desk panels in this lobby (second reference image). Preserve lighting, geometry, reflections, and all other materials. Photorealistic, no text or watermarks.",
      targetSurfaces: ["feature wall", "reception desk"],
      status: "complete",
      model: "demo/fixture",
      durationMs: 4800,
      createdAt: et("2026-03-06T15:20"),
    },
    {
      id: sid("scene:hero-steel-conference"),
      productId: sid(`product:${steel.sku}`),
      sourcePhotoBlobUrl: `/api/blob/${confKey}`,
      outputBlobUrl: `/api/blob/${confSceneKey}`,
      prompt:
        "Apply this brushed steel architectural film (first reference image) to the end wall in this conference room (second reference image). Preserve lighting, geometry, reflections, and all other materials. Photorealistic, no text or watermarks.",
      targetSurfaces: ["end wall"],
      status: "complete",
      model: "demo/fixture",
      durationMs: 5100,
      createdAt: et("2026-03-06T15:26"),
    },
  ]);
}

async function seedSampleOrders() {
  // 6–8 historical sample orders across statuses (WO-09 task 8).
  const defs = [
    { key: "smp-1", accountKey: "ds-halcyon", contact: "Nina Brandt", products: ["Blush Clay", "Sage"], status: "delivered", daysAgo: 18 },
    { key: "smp-2", accountKey: "ar-merrow", contact: "Lauren Tate", products: ["Smoked Oak"], status: "delivered", daysAgo: 14 },
    { key: "smp-3", accountKey: "ds-vantage", contact: "Kayla Dunn", products: ["Natural Cork", "Linen Weave"], status: "shipped", daysAgo: 4 },
    { key: "smp-4", accountKey: "ar-fieldstone", contact: "Drew Calloway", products: ["Concrete Cast"], status: "shipped", daysAgo: 3 },
    { key: "smp-5", accountKey: "ow-crownridge", contact: "Ivy Chen", products: ["Onyx Smoke", "Travertine"], status: "ordered", daysAgo: 1 },
    { key: "smp-6", accountKey: "gc-keystone", contact: "Miles Overton", products: ["Deep Navy"], status: "ordered", daysAgo: 1 },
    { key: "smp-7", accountKey: "ar-calder", contact: "Ben Osei", products: ["Carrara Marble"], status: "delivered", daysAgo: 22 },
  ] as const;
  const { skuOf } = await import("./data/catalog");
  await db.insert(sampleOrders).values(
    defs.map((d) => {
      const acct = accountByKey(d.accountKey);
      const orderedAt = new Date(DEMO_NOW.getTime() - d.daysAgo * 86_400_000);
      return {
        id: sid(`sample:${d.key}`),
        accountId: sid(`account:${d.accountKey}`),
        contactId: sid(`contact:${d.accountKey}:${d.contact}`),
        items: d.products.map((p) => ({ productId: sid(`product:${skuOf(p)}`), size: "8x10" as const, qty: 1 })),
        shipTo: { ...acct.address, source: "account_on_file" as const },
        status: d.status,
        orderedAt,
        shippedAt: d.status !== "ordered" ? new Date(orderedAt.getTime() + 86_400_000) : null,
        deliveredAt: d.status === "delivered" ? new Date(orderedAt.getTime() + 4 * 86_400_000) : null,
        createdAt: orderedAt,
      };
    }),
  );
}

async function seedMarketingAssets() {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const defs = [
    { key: "asset-wood-brochure", kind: "brochure" as const, title: "Wood Grain Collection Brochure", tags: ["wood", "collection"], families: ["wood"] },
    { key: "asset-texture-brochure", kind: "brochure" as const, title: "Texture Collection Brochure", tags: ["texture", "collection"], families: ["texture"] },
    { key: "asset-overview", kind: "brochure" as const, title: "Meridian Surfaces Overview", tags: ["overview"], families: [] },
    { key: "asset-healthcare-cs", kind: "case_study" as const, title: "Healthcare Corridors Case Study", tags: ["healthcare", "case-study"], families: ["wood", "solid"] },
    { key: "asset-hospitality-cs", kind: "case_study" as const, title: "Hospitality Renovation Case Study", tags: ["hospitality", "case-study"], families: ["stone", "texture"] },
  ];
  const rows: (typeof assets.$inferInsert)[] = [];
  for (const d of defs) {
    const key = `assets/${d.key}.pdf`;
    if (!(await blobExists(key))) {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const page = doc.addPage([612, 792]);
      page.drawText("MERIDIAN SURFACES CO.", { x: 54, y: 744, size: 9, font });
      page.drawText(d.title, { x: 54, y: 700, size: 20, font: bold });
      page.drawText(
        "Architectural film and surface finishes for commercial interiors. Fictional demo collateral.",
        { x: 54, y: 670, size: 10, font },
      );
      await putBlob(key, Buffer.from(await doc.save()), { contentType: "application/pdf" });
    }
    const productIds = CATALOG.filter((c) => d.families.includes(c.family))
      .slice(0, 6)
      .map((c) => sid(`product:${c.sku}`));
    rows.push({
      id: sid(`asset:${d.key}`),
      kind: d.kind,
      title: d.title,
      blobUrl: `/api/blob/${key}`,
      contentType: "application/pdf",
      tags: d.tags,
      productIds,
    });
  }
  await db.insert(assets).values(rows);
}

async function seedTargets() {
  await db.insert(targets).values([
    { id: sid("target:created:week"), period: "week", metric: "created", valueCents: TARGET_CREATED_WEEK_CENTS },
    { id: sid("target:invoiced:week"), period: "week", metric: "invoiced", valueCents: TARGET_INVOICED_WEEK_CENTS },
    { id: sid("target:created:month"), period: "month", metric: "created", valueCents: TARGET_CREATED_MONTH_CENTS },
    { id: sid("target:invoiced:month"), period: "month", metric: "invoiced", valueCents: TARGET_INVOICED_MONTH_CENTS },
  ]);
}

// CLI entrypoint (`pnpm seed [--reset-day]`); imports never auto-run.
const invokedDirectly = (process.argv[1] ?? "").replace(/\\/g, "/").includes("db/seed/index");
if (invokedDirectly) {
  const args = process.argv.slice(2);
  runSeed({
    resetDay: args.includes("--reset-day"),
    withOvernight: args.includes("--with-overnight"),
    withApprovals: args.includes("--with-approvals"),
  })
    .then(async (res) => {
      if (!res.ok) process.exitCode = 1;
      await closeDb();
    })
    .catch(async (err) => {
      console.error("[seed] failed:", err);
      process.exitCode = 1;
      await closeDb();
    });
}
