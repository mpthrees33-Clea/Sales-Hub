export type ProductCategory =
  | 'LVP'
  | 'SPC'
  | 'Hardwood'
  | 'Engineered Hardwood'
  | 'Laminate'
  | 'Carpet'
  | 'Tile'
  | 'Cork'
  | 'Bamboo'
  | 'Area Rug'
  | 'Other';

export type CustomerType = 'Contractor' | 'Architect' | 'Designer' | 'Dealer' | 'Homeowner';

// Functional roles a customer can play on a project — independent of their
// CustomerType. Many real customers wear multiple hats (e.g. Northwood Ravin
// is both a developer AND a GC). roles[] lets the stakeholder pickers filter
// candidates correctly even when CustomerType is a single-value field.
export type CustomerRole = 'developer' | 'gc' | 'architect' | 'end_user';
export type ProjectStatus = 'Lead' | 'Active' | 'Bidding' | 'Won' | 'Lost';
export type SampleOrderStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered';

// Pack & shipping data — sf/ctn, sf/plt, lbs/ctn, lbs/plt, etc.
export interface ProductPack {
  sfPerCarton?: number;
  sfPerPallet?: number;
  cartonsPerPallet?: number;
  lbsPerCarton?: number;
  lbsPerPallet?: number;
  piecesPerCarton?: number;
}

// Container quantities (LVT, wall tile, ceramic — full-load buys)
export interface ProductContainer {
  cartonsPerContainer?: number;
  sfPerContainer?: number;
  palletsPerContainer?: number;
}

// Physical dimensions
export interface ProductDimensions {
  thicknessMm?: number;     // overall thickness in mm
  lengthIn?: number;        // plank/tile length in inches
  widthIn?: number;         // plank/tile width in inches
  wearLayerMil?: number;    // LVT/SPC wear layer in mil
}

// Global app settings (targets, etc.)
export interface AppSettings {
  weeklySalesTarget: number;
  monthlySalesTarget: number;
  weeklyInvoiceTarget: number;
  monthlyInvoiceTarget: number;
}

export interface PrivateLabel {
  brand: string;
  productName: string;
  sku: string;
  listPrice?: number;
  netPrice?: number;
}

export interface Product {
  id: string;
  trinityName: string;
  trinitySku: string;
  category: ProductCategory;
  subcategory?: string;
  description: string;
  specs: Record<string, string>;
  privateLabels: PrivateLabel[];
  tags: string[];
  brochureIds: string[];
  listPrice: number;
  netPrice: number;
  unit: 'sq ft' | 'sq yd' | 'carton' | 'each';
  sqftPerCarton?: number;
  status: 'active' | 'discontinued' | 'limited';

  // Commercial spec data (optional — populated as data lands)
  pack?: ProductPack;
  container?: ProductContainer;
  dimensions?: ProductDimensions;
  lot?: string;
  shade?: string;
}

export interface Brochure {
  id: string;
  name: string;
  brand: string;
  category: string;
  fileName: string;
  fileSize?: number;
  uploadDate: string;
  tags: string[];
  description?: string;
  productIds: string[];
  pageCount?: number;
  hasFile?: boolean;
}

export interface Catalog {
  id: string;
  name: string;
  version: string;
  description?: string;
  brochureIds: string[];
  createdDate: string;
  modifiedDate: string;
  targetAudience: 'Architect' | 'Designer' | 'Contractor' | 'General';
  isTemplate: boolean;
  parentCatalogId?: string;
  tags: string[];
  customerId?: string;
}

// Multiple contacts per customer
export interface CustomerContact {
  id: string;
  name: string;
  title?: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

// Multiple ship-to addresses per customer
export interface ShipToAddress {
  id: string;
  label: string;     // e.g. "Main Office", "Warehouse", "Job Site 1"
  address: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  name: string;          // primary contact name (legacy/display)
  company: string;
  type: CustomerType;
  email: string;         // primary email (legacy/display)
  phone: string;         // primary phone (legacy/display)
  // Billing address
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  // Multiple contacts
  contacts: CustomerContact[];
  // Multiple ship-to addresses
  shipToAddresses: ShipToAddress[];
  notes?: string;
  createdDate: string;
  // Functional roles the customer plays. Used by the stakeholder pickers
  // on opportunities — a single customer can be flagged as both a
  // developer and a GC for design-build firms like Northwood Ravin.
  roles?: CustomerRole[];
}

export interface ProjectNote {
  id: string;
  date: string;
  text: string;
  author: string;
}

export interface Project {
  id: string;
  customerId: string;
  name: string;
  description: string;
  address?: string;
  status: ProjectStatus;
  value: number;
  productIds: string[];
  notes: ProjectNote[];
  sampleOrderIds: string[];
  createdDate: string;
  anticipatedOrderDate?: string;
  closingDate?: string;
  invoicedDate?: string;
  invoicedAmount?: number;
}

export interface SampleOrderItem {
  productId: string;
  productName: string;
  privateLabelName?: string;
  quantity: number;
  notes?: string;
}

export interface SampleOrder {
  id: string;
  customerId: string;
  projectId: string;
  items: SampleOrderItem[];
  status: SampleOrderStatus;
  orderedDate: string;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  notes?: string;
  trackingNumber?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  fromName: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash';
  attachedBrochureIds: string[];
}

export interface PriceEntry {
  id: string;
  productId: string;
  trinityName: string;
  trinitySku: string;
  privateLabelBrand: string;
  privateLabelName: string;
  privateLabelSku: string;
  listPrice: number;
  netPrice: number;
  unit: string;
  effectiveDate: string;
  notes?: string;
}

export interface DistributorPriceEntry {
  id: string;
  productName: string;
  sku: string;
  category: string;
  listPrice: number;
  dealerPrice: number;
  unit: string;
}

export interface DistributorPriceList {
  id: string;
  distributorName: string;
  uploadDate: string;
  effectiveDate: string;
  entries: DistributorPriceEntry[];
}

// ── EXTENDED SCHEMAS (foundation slice — additive, production-shaped) ──
//
// Reps & locations. Slice 0 introduces multi-rep awareness so the email AI,
// CRM, and dashboards can scope by rep. Existing entities get optional
// salesRepId fields; seed data backfills them on the active rep ("you").

export interface SalesLocation {
  id: string;          // e.g. '210' (matches user's spec for Charlotte)
  name: string;        // e.g. 'Charlotte'
  region: string;      // e.g. 'NC'
  city: string;
  state: string;
}

export interface Rep {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  salesLocationId: string;
  isCurrentUser?: boolean;  // dev-mode "who am I right now" flag
}

// ── Opportunity / project extensions ──────────────────────────
// User asked for distinct Status (high-level) and Stage (workflow position).
// Keeping ProjectStatus as-is for the current CRM page; new fields are
// optional so existing data continues to render.

export type OpportunityStatus =
  | 'active'
  | 'won'
  | 'lost'
  | 'not_pursued'
  | 'on_hold';

export type OpportunityStage =
  | 'lead_qualification'
  | 'design'
  | 'bidding'
  | 'awarded'
  | 'orders_pending'
  | 'orders_placed'
  | 'closed';

export type ProjectType =
  | 'multifamily'
  | 'corporate'
  | 'government'
  | 'community'
  | 'healthcare'
  | 'hospitality'
  | 'retail'
  | 'mixed_use'
  | 'education'
  | 'industrial'
  | 'single_family'
  | 'other';

// Companies that we have quoted on a given project. Used for GC↔sub learning
// over time. Auto-populated when a quote is sent.
export interface Bidder {
  id: string;
  customerId: string;       // who we quoted
  quotedDate: string;
  quotedAmount?: number;
  awarded?: boolean;        // did they win the bid (tracked separately from project award)
  notes?: string;
}

// Directed edge: GC → sub. Builds the relationship graph as projects close.
export interface GcSubEdge {
  id: string;
  gcCustomerId: string;
  subCustomerId: string;
  projectId: string;
  wonDate: string;
  projectValue?: number;
}

// Per-opportunity activity log (calls, meetings, emails, notes, status changes).
// Drives the AI summary panel and dormancy detection.
export type ActivityType =
  | 'email_in'
  | 'email_out'
  | 'call'
  | 'meeting'
  | 'note'
  | 'status_change'
  | 'stage_change'
  | 'quote_sent'
  | 'sample_sent'
  | 'site_visit';

export interface Activity {
  id: string;
  projectId: string;
  repId: string;
  type: ActivityType;
  date: string;
  summary: string;          // short, human-readable
  body?: string;            // optional long-form (e.g. meeting notes)
  relatedEmailId?: string;
  relatedQuoteId?: string;
}

// New optional project fields. Foundation backfills these on existing seed
// projects so the CRM redesign in slice 2 starts with real data.
export interface ProjectExtensions {
  opportunityId?: string;        // separate from project id (human-readable, e.g. 'OPP-2025-0142')
  salesRepId?: string;
  salesLocationId?: string;
  projectType?: ProjectType;
  opportunityStatus?: OpportunityStatus;
  opportunityStage?: OpportunityStage;
  nextStep?: string;
  updatedDate?: string;          // last activity / edit timestamp
  architecturalFirmId?: string;  // customerId of the spec firm
  gcCustomerId?: string;         // customerId of the GC if awarded
  developerCustomerId?: string;  // customerId of the developer
  endUserCustomerId?: string;    // owner/end user (for design firm projects)
  jobLocation?: string;          // city/site location text (separate from billing address)
  bidders?: Bidder[];
  cmdProjectId?: string;         // ConstructConnect / CMD link (mocked for now)
  lastTouchAt?: string;          // computed from activities; cached for dormancy queries
  aiSummary?: string;                    // refreshed by the AI summary endpoint
  aiSuggestedNextStep?: string;          // AI-suggested next action, one-click into nextStep
  aiDormancyAlert?: string;              // optional re-engagement nudge from the summary
  aiSummaryUpdatedAt?: string;
}

// ── Email threading + auto-draft pipeline ─────────────────────

export type EmailIntent =
  | 'pricing_request'
  | 'spec_sheet_request'
  | 'general_inquiry'
  | 'scheduling'
  | 'new_lead'
  | 'follow_up'
  | 'dormant_reply'
  | 'sample_request'
  | 'order_question'
  | 'other';

export interface EmailThread {
  id: string;
  subject: string;
  participantEmails: string[];
  customerId?: string;
  projectId?: string;
  lastMessageAt: string;
  unreadCount: number;
}

// Fields the AI still needs before it can write a real quote. Used to render
// "I just need X, Y, Z" inline asks in the draft body, and [PLACEHOLDER]
// scaffolds in the quote table.
export type QuoteMissingField =
  | 'project_name'
  | 'architectural_firm'
  | 'gc'
  | 'developer'
  | 'end_user'
  | 'job_location'
  | 'product'
  | 'size'
  | 'color'
  | 'finish'
  | 'quantity';

export interface MissingFieldAsk {
  field: QuoteMissingField;
  contextLabel: string;     // e.g. "developer", "qty for Peachtree Oak EHW"
  hint?: string;
}

export interface QuoteLineItem {
  id: string;
  productId?: string;       // resolved match if found
  productName: string;      // raw name from email or matched Trinity name
  size?: string;            // "12x24", "5in plank", etc.
  color?: string;
  finish?: string;
  quantity?: number;
  unit: string;
  unitPrice?: number;       // from pricing engine; undefined when pending
  totalPrice?: number;
  pricingPending?: boolean; // true when product not on sheet
  placeholderFields?: QuoteMissingField[];  // fields the rep still needs to fill
}

export interface Quote {
  id: string;
  projectId?: string;       // linked once project is known
  customerId?: string;
  repId: string;
  createdDate: string;
  sentDate?: string;
  lineItems: QuoteLineItem[];
  subtotal?: number;
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  emailDraftId?: string;    // the draft this quote was attached to
}

// Auto-drafted reply to a received email. Generated by the email AI pipeline
// on inbox load; rep edits + sends from the email page.
export interface EmailDraft {
  id: string;
  inReplyToEmailId: string;
  threadId: string;
  repId: string;
  createdAt: string;
  updatedAt: string;
  subject: string;
  body: string;
  attachedBrochureIds: string[];
  intent: EmailIntent;
  matchedProjectId?: string;
  matchedCustomerId?: string;
  quoteId?: string;             // attached quote if pricing-shaped
  missingFieldAsks: MissingFieldAsk[];
  isAutoDrafted: boolean;
  isEdited: boolean;
  status: 'pending' | 'ready' | 'sent' | 'discarded';
  sentAt?: string;
}

// Extension fields layered onto the existing EmailMessage. We don't rewrite
// EmailMessage so the current EmailPage keeps working; new fields are read
// opportunistically by the email AI pipeline.
export interface EmailMessageExtensions {
  threadId?: string;
  repId?: string;
  intent?: EmailIntent;
  projectId?: string;            // matched once classification runs
  customerId?: string;
  draftId?: string;              // the auto-drafted reply, when one exists
  processingState?: 'unprocessed' | 'classified' | 'draft_ready' | 'needs_project_link' | 'sent';
  newProjectCandidate?: {
    suggestedName: string;
    suggestedFirm?: string;
    suggestedLocation?: string;
    confidence: number;          // 0..1
  };
}

// ── Weekly dormant digest ─────────────────────────────────────

export interface DormantAccountEntry {
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  lastTouchAt: string;
  daysDormant: number;
  pastOpportunityValue: number;   // sum of past projects with this customer
  draftEmailId?: string;          // pre-generated re-engagement draft
  templateType: 'lunch_and_learn' | 'presentation_invite' | 'check_in' | 'new_opportunity';
}

export interface DormantDigest {
  id: string;
  repId: string;
  weekOf: string;                 // ISO date of the Monday this digest is for
  generatedAt: string;
  entries: DormantAccountEntry[];
  sentAsEmailId?: string;         // the mock "system" email that landed in inbox
}

// ── Pricing rule config (foundation; rules defined in src/config/pricingRules.ts) ──

export interface SizeTier {
  matches: string[];               // patterns: "12x24", "24x24", "5in plank", etc.
  multiplier: number;              // applied to base net price
}

export interface FinishSurcharge {
  finish: string;                  // "Polished", "Hand-Scraped", etc.
  amountPerUnit: number;           // added to base net price
}

export interface QtyDiscountTier {
  minQty: number;                  // quantity threshold in product's unit
  discountPct: number;             // applied to base price
}

export interface PricingRules {
  sizeTiers: SizeTier[];
  finishSurcharges: FinishSurcharge[];
  qtyDiscountTiers: QtyDiscountTier[];
}

// ── Augmented entity types (composed via intersection so existing usages still type-check) ──
// Pages can opt in to the extended view by importing these aliases.

export type ExtendedProject = Project & ProjectExtensions;
export type ExtendedEmailMessage = EmailMessage & EmailMessageExtensions;
