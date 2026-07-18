/**
 * Clea Sales Hub — full data model (docs/01-ARCHITECTURE.md §4).
 *
 * Conventions: uuid `id` pk, `created_at`/`updated_at` timestamptz, snake_case
 * columns, pg enums for enumerated columns, money as integer cents, dates UTC.
 * Owner-WO schema additions (triage_routings, style_profiles, morning_briefs,
 * routes_cache, approvals.blocked_reason, …) are defined here because all work
 * orders are executed in this build.
 */
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────────

export const accountType = pgEnum("account_type", ["gc", "architect", "designer", "distributor", "owner"]);
export const priceTier = pgEnum("price_tier", ["list", "distributor", "project"]);
export const projectSegment = pgEnum("project_segment", [
  "office_ti",
  "hospitality",
  "healthcare",
  "education",
  "retail",
  "multifamily",
]);
export const opportunityStage = pgEnum("opportunity_stage", [
  "lead",
  "qualified",
  "specified_bod",
  "quoted",
  "po_received",
  "closed_won",
  "closed_lost",
]);
export const activityType = pgEnum("activity_type", ["email", "meeting", "call", "note", "sample", "quote", "po"]);
export const triageCategory = pgEnum("triage_category", [
  "quote_request",
  "stock_check",
  "po",
  "sample_request",
  "submittal_request",
  "scheduling",
  "general",
  "noise",
]);
export const threadStatus = pgEnum("thread_status", ["active", "archived", "needs_review"]);
export const emailDirection = pgEnum("email_direction", ["inbound", "outbound"]);
export const productFamily = pgEnum("product_family", ["wood", "metal", "stone", "solid", "texture"]);
export const pdsKind = pgEnum("pds_kind", ["pds", "install", "test_report", "warranty"]);
export const quoteStatus = pgEnum("quote_status", ["draft", "pending_approval", "sent", "accepted", "expired"]);
export const poStatus = pgEnum("po_status", ["received", "extracted", "validated", "escalated", "converted"]);
export const salesOrderStatus = pgEnum("sales_order_status", ["draft", "confirmed", "invoiced", "cancelled"]);
export const sampleOrderStatus = pgEnum("sample_order_status", [
  "draft",
  "pending_approval",
  "ordered",
  "shipped",
  "delivered",
]);
export const submittalStatus = pgEnum("submittal_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "escalated",
]);
export const assetKind = pgEnum("asset_kind", [
  "brochure",
  "case_study",
  "presentation",
  "scene",
  "swatch",
  "submittal",
]);
export const presentationStatus = pgEnum("presentation_status", ["draft", "ready"]);
export const sceneStatus = pgEnum("scene_status", ["pending", "generating", "complete", "failed"]);
export const meetingStatus = pgEnum("meeting_status", ["scheduled", "completed", "cancelled"]);
export const runTrigger = pgEnum("run_trigger", ["nightly", "user", "workflow", "system"]);
export const runStatus = pgEnum("run_status", ["running", "succeeded", "escalated", "failed"]);
export const stepKind = pgEnum("step_kind", ["llm_call", "tool_call", "validation", "escalation", "workflow_step"]);
export const approvalKind = pgEnum("approval_kind", [
  "email_draft",
  "quote",
  "sales_order",
  "sample_order",
  "opportunity_update",
  "submittal",
  "scene_send",
]);
export const riskTier = pgEnum("risk_tier", ["low", "standard", "high"]);
export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "edited_approved",
  "rejected",
  "expired",
]);
export const routingTarget = pgEnum("routing_target", ["quote", "po_intake", "sample", "reply", "submittal", "none"]);
export const routingStatus = pgEnum("routing_status", ["pending", "in_progress", "consumed", "dismissed"]);
export const targetMetric = pgEnum("target_metric", ["created", "invoiced"]);
export const targetPeriod = pgEnum("target_period", ["week", "month"]);

// ── Shared column helpers ────────────────────────────────────────────────────

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/** Postal address shape stored as jsonb. */
export type Address = { line1: string; line2?: string; city: string; state: string; zip: string };

// ── CRM core ─────────────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: accountType("type").notNull(),
  address: jsonb("address").$type<Address>().notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  tier: priceTier("tier").notNull().default("list"),
  creditLimitCents: integer("credit_limit_cents").notNull().default(25_000_000),
  ...timestamps,
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    role: text("role"),
    ...timestamps,
  },
  (t) => [uniqueIndex("contacts_email_idx").on(t.email)],
);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  name: text("name").notNull(),
  segment: projectSegment("segment").notNull(),
  stage: text("stage"),
  address: jsonb("address").$type<Address>().notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  gcName: text("gc_name"),
  architectName: text("architect_name"),
  ...timestamps,
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  name: text("name").notNull(),
  stage: opportunityStage("stage").notNull(),
  valueCents: integer("value_cents").notNull(),
  probability: integer("probability").notNull().default(50),
  expectedClose: date("expected_close"),
  nextStep: text("next_step"),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  ...timestamps,
});

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: activityType("type").notNull(),
    accountId: uuid("account_id").references(() => accounts.id),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("activities_occurred_at_idx").on(t.occurredAt)],
);

// ── Email ────────────────────────────────────────────────────────────────────

export const emailThreads = pgTable("email_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  participants: text("participants").array().notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(),
  triage: triageCategory("triage"),
  triageConfidence: numeric("triage_confidence", { precision: 4, scale: 3 }),
  status: threadStatus("status").notNull().default("active"),
  ...timestamps,
});

export type EmailAttachment = { name: string; contentType: string; blobKey: string; sizeBytes: number };

export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => emailThreads.id),
    direction: emailDirection("direction").notNull(),
    fromEmail: text("from_email").notNull(),
    toEmails: text("to_emails").array().notNull(),
    ccEmails: text("cc_emails").array().notNull().default([]),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    bodyHtmlSanitized: text("body_html_sanitized"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    attachments: jsonb("attachments").$type<EmailAttachment[]>().notNull().default([]),
    isProcessed: boolean("is_processed").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("emails_thread_received_idx").on(t.threadId, t.receivedAt)],
);

// ── Meetings ─────────────────────────────────────────────────────────────────

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  accountId: uuid("account_id").references(() => accounts.id),
  projectId: uuid("project_id").references(() => projects.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  location: text("location"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  prepNotes: text("prep_notes"),
  status: meetingStatus("status").notNull().default("scheduled"),
  ...timestamps,
});

export type TranscriptSegment = { speaker: string; t0: number; t1: number; text: string };
export type ActionItem = { text: string; owner: "rep" | "customer"; dueHint?: string; segmentRefs: number[] };

export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id)
    .unique(),
  audioBlobUrl: text("audio_blob_url"),
  segments: jsonb("segments").$type<TranscriptSegment[]>(),
  summary: text("summary"),
  actionItems: jsonb("action_items").$type<ActionItem[]>(),
  ...timestamps,
});

// ── Product / ERP ────────────────────────────────────────────────────────────

export type ProductSpec = {
  thicknessMm: number;
  widthMm: number;
  fireRating: string;
  adhesive: string;
  [k: string]: unknown;
};

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    family: productFamily("family").notNull(),
    finish: text("finish").notNull(),
    description: text("description").notNull(),
    swatchBlobUrl: text("swatch_blob_url"),
    unit: text("unit").notNull().default("roll"),
    spec: jsonb("spec").$type<ProductSpec>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("products_sku_idx").on(t.sku)],
);

export const pdsDocuments = pgTable("pds_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  kind: pdsKind("kind").notNull(),
  title: text("title").notNull(),
  blobUrl: text("blob_url").notNull(),
  pages: integer("pages").notNull().default(1),
  ...timestamps,
});

export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id)
    .unique(),
  onHand: integer("on_hand").notNull(),
  allocated: integer("allocated").notNull().default(0),
  leadTimeDays: integer("lead_time_days").notNull(),
  restockAt: timestamp("restock_at", { withTimezone: true }),
  ...timestamps,
});

export const priceLists = pgTable("price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: priceTier("tier").notNull(),
  ...timestamps,
});

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    unitPriceCents: integer("unit_price_cents").notNull(),
    minQty: integer("min_qty").notNull().default(1),
    ...timestamps,
  },
  (t) => [uniqueIndex("price_list_items_list_product_idx").on(t.priceListId, t.productId)],
);

export const accountPriceLists = pgTable(
  "account_price_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id)
      .unique(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id),
    ...timestamps,
  },
);

// ── Commerce ─────────────────────────────────────────────────────────────────

export type QuoteLine = {
  productId: string;
  sku: string;
  description: string;
  qty: number;
  uom: string;
  unitPriceCents: number;
  extendedCents: number;
  leadTimeDays: number;
  sourceRowId: string; // price_list_items.id provenance
  splitProposed?: boolean;
  availableNow?: number;
};

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id),
    number: text("number").notNull(),
    status: quoteStatus("status").notNull().default("draft"),
    lines: jsonb("lines").$type<QuoteLine[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    validUntil: date("valid_until"),
    sourceEmailId: uuid("source_email_id"),
    latencyMs: integer("latency_ms"),
    ...timestamps,
  },
  (t) => [uniqueIndex("quotes_number_idx").on(t.number)],
);

export type ValidationLayerResult = {
  layer: number;
  name: string;
  pass: boolean;
  detail: Record<string, unknown>;
  durationMs: number;
};

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  blobUrl: text("blob_url").notNull(),
  extracted: jsonb("extracted").$type<Record<string, unknown>>(),
  validation: jsonb("validation").$type<ValidationLayerResult[]>(),
  status: poStatus("status").notNull().default("received"),
  customerPoNumber: text("customer_po_number"),
  accountId: uuid("account_id").references(() => accounts.id),
  sourceEmailId: uuid("source_email_id"),
  elapsedMs: integer("elapsed_ms"),
  ...timestamps,
});

export type SalesOrderLine = {
  productId: string;
  sku: string;
  description: string;
  qty: number;
  uom: string;
  unitPriceCents: number;
  extendedCents: number;
};

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poId: uuid("po_id").references(() => purchaseOrders.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    number: text("number").notNull(),
    lines: jsonb("lines").$type<SalesOrderLine[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    status: salesOrderStatus("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [uniqueIndex("sales_orders_number_idx").on(t.number)],
);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id),
  number: text("number").notNull(),
  amountCents: integer("amount_cents").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ...timestamps,
});

export const SAMPLE_SIZES = ["chip", "8x10", "full_sheet"] as const;
export type SampleSize = (typeof SAMPLE_SIZES)[number];
export type SampleItem = { productId: string; size: SampleSize; qty: number };

export const sampleOrders = pgTable("sample_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  items: jsonb("items").$type<SampleItem[]>().notNull(),
  shipTo: jsonb("ship_to").$type<Address & { source?: "email" | "account_on_file" }>().notNull(),
  status: sampleOrderStatus("status").notNull().default("draft"),
  sourceEmailId: uuid("source_email_id"),
  orderedAt: timestamp("ordered_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  ...timestamps,
});

export type SubmittalSection = {
  productId: string;
  sku: string;
  productName: string;
  docs: { pdsDocumentId: string; kind: "pds" | "install" | "test_report" | "warranty"; title: string }[];
  note?: string;
  startPage?: number;
};

export const submittalPackages = pgTable("submittal_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  submittalNumber: text("submittal_number"),
  productIds: uuid("product_ids").array().notNull(),
  sections: jsonb("sections").$type<SubmittalSection[]>(),
  coverSheet: jsonb("cover_sheet").$type<Record<string, string>>(),
  status: submittalStatus("status").notNull().default("draft"),
  outputBlobUrl: text("output_blob_url"),
  sourceEmailId: uuid("source_email_id"),
  ...timestamps,
});

// ── Assets ───────────────────────────────────────────────────────────────────

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: assetKind("kind").notNull(),
  title: text("title").notNull(),
  blobUrl: text("blob_url").notNull(),
  contentType: text("content_type").notNull().default("application/pdf"),
  tags: text("tags").array().notNull().default([]),
  productIds: uuid("product_ids").array().notNull().default([]),
  ...timestamps,
});

export type Slide =
  | { kind: "title"; title: string; subtitle: string }
  | {
      kind: "product";
      productId: string;
      sku: string;
      name: string;
      finish: string;
      specLines: string[];
      swatchBlobUrl?: string;
      sceneBlobUrl?: string;
      talkingPoint?: string;
    }
  | { kind: "closing"; repName: string; repEmail: string; repPhone: string; company: string };

export const presentations = pgTable("presentations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slides: jsonb("slides").$type<Slide[]>().notNull(),
  status: presentationStatus("status").notNull().default("draft"),
  exportedAssetId: uuid("exported_asset_id"),
  ...timestamps,
});

export const roomScenes = pgTable("room_scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  sourcePhotoBlobUrl: text("source_photo_blob_url").notNull(),
  outputBlobUrl: text("output_blob_url"),
  prompt: text("prompt").notNull(),
  targetSurfaces: text("target_surfaces").array().notNull().default([]),
  status: sceneStatus("status").notNull().default("pending"),
  model: text("model"),
  durationMs: integer("duration_ms"),
  ...timestamps,
});

// ── Agent infrastructure (the showcase) ──────────────────────────────────────

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentName: text("agent_name").notNull(),
    trigger: runTrigger("trigger").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    status: runStatus("status").notNull().default("running"),
    model: text("model"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    workflowRunId: text("workflow_run_id"),
    dedupKey: text("dedup_key"),
    ...timestamps,
  },
  (t) => [
    index("agent_runs_started_idx").on(t.startedAt),
    uniqueIndex("agent_runs_dedup_idx").on(t.dedupKey),
  ],
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id),
    seq: integer("seq").notNull(),
    kind: stepKind("kind").notNull(),
    name: text("name").notNull(),
    input: jsonb("input").$type<unknown>(),
    output: jsonb("output").$type<unknown>(),
    durationMs: integer("duration_ms").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("agent_steps_run_seq_idx").on(t.runId, t.seq)],
);

export type Evidence = {
  type: "email" | "pdf_page" | "price_row" | "transcript_segment" | "inventory_row";
  ref: Record<string, unknown>;
  quote: string;
};

export type EditDiff = { path: string; old: unknown; new: unknown };

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").references(() => agentRuns.id),
    kind: approvalKind("kind").notNull(),
    riskTier: riskTier("risk_tier").notNull(),
    proposedAction: jsonb("proposed_action").$type<Record<string, unknown>>().notNull(),
    evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
    status: approvalStatus("status").notNull().default("pending"),
    approverUserId: uuid("approver_user_id"),
    edits: jsonb("edits").$type<EditDiff[]>(),
    blockedReason: jsonb("blocked_reason").$type<{ rule: string; reason: string } | null>(),
    createdDemoAt: timestamp("created_demo_at", { withTimezone: true }).notNull(),
    expiresDemoAt: timestamp("expires_demo_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("approvals_status_tier_idx").on(t.status, t.riskTier)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actor: text("actor").notNull(), // agent:<name> | user:<id> | system
    action: text("action").notNull(),
    objectType: text("object_type"),
    objectId: text("object_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    demoAt: timestamp("demo_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);

export const demoState = pgTable("demo_state", {
  id: integer("id").primaryKey().default(1),
  demoNow: timestamp("demo_now", { withTimezone: true }).notNull(),
  lastNightlyRunAt: timestamp("last_nightly_run_at", { withTimezone: true }),
  scenarioVersion: text("scenario_version").notNull().default("v1"),
  showDemoChip: boolean("show_demo_chip").notNull().default(true),
  ...timestamps,
});

export const targets = pgTable("targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  period: targetPeriod("period").notNull(),
  metric: targetMetric("metric").notNull(),
  valueCents: integer("value_cents").notNull(),
  ...timestamps,
});

// ── Cross-WO contract tables ─────────────────────────────────────────────────

/** WO-04: one routing row per triaged inbound email (unique on email_id). */
export const triageRoutings = pgTable(
  "triage_routings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailId: uuid("email_id")
      .notNull()
      .references(() => emails.id)
      .unique(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => emailThreads.id),
    category: triageCategory("category").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    target: routingTarget("target").notNull(),
    status: routingStatus("status").notNull().default("pending"),
    consumedByRunId: uuid("consumed_by_run_id").references(() => agentRuns.id),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    ...timestamps,
  },
);

export type StyleCard = {
  greetingPatterns: string[];
  signoff: string;
  register: string;
  phrasePreferences: string[];
  avoid: string[];
  avgLengthWords: number;
  fewShotSnippets: string[];
};

export const styleProfiles = pgTable(
  "style_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    persona: text("persona").notNull().default("cole"),
    card: jsonb("card").$type<StyleCard>().notNull(),
    sourceEmailIds: uuid("source_email_ids").array().notNull(),
    model: text("model").notNull(),
    builtAt: timestamp("built_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("style_profiles_persona_idx").on(t.persona)],
);

/** WO-08: morning brief persisted per nightly run. */
export const morningBriefs = pgTable("morning_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => agentRuns.id),
  brief: jsonb("brief").$type<Record<string, unknown>>().notNull(),
  narrative: text("narrative").notNull(),
  briefDate: date("brief_date").notNull(),
  ...timestamps,
});

/** WO-12: one optimized route per demo-day, computed at most once. */
export const routesCache = pgTable(
  "routes_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeDate: date("route_date").notNull(),
    variant: text("variant").notNull().default("default"), // round-trip / exclusions key
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("routes_cache_date_variant_idx").on(t.routeDate, t.variant)],
);
