/**
 * Projects, opportunities (~25, incl. specified_bod), meetings (Monday's two
 * completed + Tuesday's three with geo + prep notes), and activities.
 */
import { et } from "../scenario";
import { shash } from "../ids";

export type SeedProject = {
  key: string;
  accountKey: string;
  name: string;
  segment: "office_ti" | "hospitality" | "healthcare" | "education" | "retail" | "multifamily";
  gcName?: string;
  architectName?: string;
};

export const PROJECTS: SeedProject[] = [
  {
    key: "prj-harborview2",
    accountKey: "gc-whitaker",
    name: "Harborview Medical Phase 2",
    segment: "healthcare",
    gcName: "Whitaker Commercial Contractors",
    architectName: "Calder Design Partners",
  },
  { key: "prj-meridian12", accountKey: "gc-stonebridge", name: "Meridian Tower 12th Floor TI", segment: "office_ti", gcName: "Stonebridge Construction Group", architectName: "Merrow Architecture" },
  { key: "prj-juniper", accountKey: "gc-crestline", name: "Juniper Hotel Raleigh", segment: "hospitality", gcName: "Crestline Builders", architectName: "Pell House Architects" },
  { key: "prj-oakcity", accountKey: "ow-oakcity", name: "Oak City Offices Reception Refresh", segment: "office_ti", architectName: "Calder Design Partners" },
  { key: "prj-crownridge", accountKey: "ow-crownridge", name: "Crownridge Gateway Hotel Lobby", segment: "hospitality", architectName: "Arcline Collective" },
  { key: "prj-lakemont", accountKey: "ow-lakemont", name: "Lakemont Commons Renovation", segment: "multifamily" },
  { key: "prj-keystone-bank", accountKey: "gc-keystone", name: "First Cardinal Bank Branches", segment: "retail", gcName: "Keystone Interiors Group" },
  { key: "prj-statecampus", accountKey: "ow-stateline", name: "Stateline Campus Hub Building C", segment: "education" },
  { key: "prj-redoak-med", accountKey: "gc-redoak", name: "Ballantyne Outpatient Clinic", segment: "healthcare", gcName: "Red Oak Commercial" },
  { key: "prj-gatewood-ti", accountKey: "gc-gatewood", name: "Pierpoint Plaza 4th Floor TI", segment: "office_ti", gcName: "Gatewood Construction" },
];

export type SeedOpportunity = {
  key: string;
  accountKey: string;
  projectKey?: string;
  name: string;
  stage: "lead" | "qualified" | "specified_bod" | "quoted" | "po_received" | "closed_won" | "closed_lost";
  valueCents: number;
  probability: number;
  expectedClose: string; // yyyy-mm-dd
  nextStep: string;
};

export const OPPORTUNITIES: SeedOpportunity[] = [
  {
    key: "opp-harborview2",
    accountKey: "gc-whitaker",
    projectKey: "prj-harborview2",
    name: "Harborview Medical Ph2 — Interior Film Package",
    stage: "quoted",
    valueCents: 8_640_000,
    probability: 70,
    expectedClose: "2026-04-15",
    nextStep: "Walk-through with Ray; send Walnut Grain pricing + PDS docs",
  },
  {
    key: "opp-meridian12",
    accountKey: "gc-stonebridge",
    projectKey: "prj-meridian12",
    name: "Meridian Tower 12F — Feature Walls & Casework",
    stage: "qualified",
    valueCents: 3_120_000,
    probability: 55,
    expectedClose: "2026-04-30",
    nextStep: "Price the revised finish schedule",
  },
  {
    key: "opp-juniper",
    accountKey: "gc-crestline",
    projectKey: "prj-juniper",
    name: "Juniper Hotel — Corridors & Elevator Banks",
    stage: "quoted",
    valueCents: 5_480_000,
    probability: 60,
    expectedClose: "2026-05-15",
    nextStep: "Follow up on corridor quote",
  },
  {
    key: "opp-oakcity",
    accountKey: "ar-calder",
    projectKey: "prj-oakcity",
    name: "Oak City Reception — Basis of Design",
    stage: "specified_bod",
    valueCents: 1_480_000,
    probability: 45,
    expectedClose: "2026-06-01",
    nextStep: "Keep spec position; support Calder with samples",
  },
  {
    key: "opp-crownridge",
    accountKey: "ar-arcline",
    projectKey: "prj-crownridge",
    name: "Crownridge Lobby — BOD Spec (Arcline)",
    stage: "specified_bod",
    valueCents: 2_260_000,
    probability: 40,
    expectedClose: "2026-06-15",
    nextStep: "Send Arcline the stone-family PDS set",
  },
  {
    key: "opp-piedmont-q1042",
    accountKey: "di-piedmont",
    name: "Piedmont — Q1 Stock Program (Q-1042)",
    stage: "quoted",
    valueCents: 0, // set from Q-1042 subtotal at seed time
    probability: 80,
    expectedClose: "2026-03-20",
    nextStep: "Dana reviewing quote Q-1042",
  },
  {
    key: "opp-keystone-bank",
    accountKey: "gc-keystone",
    projectKey: "prj-keystone-bank",
    name: "First Cardinal Branches — Teller Line Refresh",
    stage: "qualified",
    valueCents: 1_890_000,
    probability: 50,
    expectedClose: "2026-05-01",
    nextStep: "Confirm branch count with Miles",
  },
  {
    key: "opp-lakemont",
    accountKey: "ow-lakemont",
    projectKey: "prj-lakemont",
    name: "Lakemont Commons — Corridor & Unit Doors",
    stage: "lead",
    valueCents: 940_000,
    probability: 25,
    expectedClose: "2026-07-01",
    nextStep: "Site visit to scope door count",
  },
  {
    key: "opp-redoak-med",
    accountKey: "gc-redoak",
    projectKey: "prj-redoak-med",
    name: "Ballantyne Clinic — Exam Room Package",
    stage: "quoted",
    valueCents: 2_140_000,
    probability: 65,
    expectedClose: "2026-04-20",
    nextStep: "Revise quote for added exam rooms",
  },
  {
    key: "opp-gatewood-ti",
    accountKey: "gc-gatewood",
    projectKey: "prj-gatewood-ti",
    name: "Pierpoint Plaza 4F — Conference Fronts",
    stage: "lead",
    valueCents: 760_000,
    probability: 30,
    expectedClose: "2026-06-15",
    nextStep: "Get finish schedule from Hank",
  },
];

/** Filler opportunities to reach ~25, deterministic across accounts. */
export const FILLER_OPPORTUNITY_ACCOUNTS = [
  "di-tristate",
  "di-metrolina",
  "di-capital",
  "di-gatecity",
  "di-southern",
  "di-eastfork",
  "ar-merrow",
  "ds-fostervale",
  "ds-halcyon",
  "ow-pinnacle",
  "ow-cardinal",
  "ow-triangle",
  "ow-guilford",
  "ow-bristol",
  "ar-fieldstone",
] as const;

export function fillerOpportunity(accountKey: string): SeedOpportunity {
  const stages: SeedOpportunity["stage"][] = ["lead", "qualified", "quoted", "closed_won", "qualified"];
  const stage = stages[shash(`fillstage:${accountKey}`, stages.length)]!;
  return {
    key: `opp-fill-${accountKey}`,
    accountKey,
    name: `${accountKey.startsWith("di-") ? "Stock program" : "Finish package"} — ${accountKey.replace(/^[a-z]+-/, "")}`,
    stage,
    valueCents: 800_000 + shash(`fillval:${accountKey}`, 140) * 10_000,
    probability: 20 + shash(`fillprob:${accountKey}`, 60),
    expectedClose: `2026-0${4 + shash(`fillclose:${accountKey}`, 4)}-15`,
    nextStep: "Quarterly check-in",
  };
}

// ── Meetings ─────────────────────────────────────────────────────────────────

export type SeedMeeting = {
  key: string;
  title: string;
  accountKey: string;
  projectKey?: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  prepNotes: string;
  status: "scheduled" | "completed";
  hasTranscript?: boolean;
};

export const MEETINGS: SeedMeeting[] = [
  {
    key: "mtg-harborview-walk",
    title: "Harborview Medical Ph2 — site walk",
    accountKey: "gc-whitaker",
    projectKey: "prj-harborview2",
    startsAt: et("2026-03-09T14:00"),
    endsAt: et("2026-03-09T15:00"),
    location: "Harborview Medical Center, 2401 Caldwell St, Charlotte, NC",
    prepNotes: "Ray wants corridor + nurse-station finishes settled before GMP. Bring Walnut Grain and Matte White samples.",
    status: "completed",
    hasTranscript: true,
  },
  {
    key: "mtg-piedmont-monday",
    title: "Piedmont Surface — Q1 stock review",
    accountKey: "di-piedmont",
    startsAt: et("2026-03-09T10:30"),
    endsAt: et("2026-03-09T11:15"),
    location: "Piedmont Surface Distribution, Charlotte",
    prepNotes: "Q-1042 open — Dana deciding quantities. Review sell-through on wood grains.",
    status: "completed",
  },
  {
    key: "mtg-stonebridge-tue",
    title: "Meridian Tower 12F — TI walkthrough",
    accountKey: "gc-stonebridge",
    projectKey: "prj-meridian12",
    startsAt: et("2026-03-10T09:30"),
    endsAt: et("2026-03-10T10:30"),
    location: "Meridian Tower, 500 S Tryon St, Charlotte, NC",
    prepNotes: "Marcus reviewing feature-wall finishes for 12F. White Oak vs Rift Oak on the elevator lobby; bring both swatches and the fire-rating one-pager.",
    status: "scheduled",
  },
  {
    key: "mtg-piedmont-lunch",
    title: "Piedmont Surface — distributor lunch",
    accountKey: "di-piedmont",
    startsAt: et("2026-03-10T12:00"),
    endsAt: et("2026-03-10T13:00"),
    location: "Haberdish, 3106 N Davidson St, Charlotte, NC",
    prepNotes: "Dana + Chris. Close Q-1042 if the PO hasn't landed; float the Q2 stock program and the new texture family.",
    status: "scheduled",
  },
  {
    key: "mtg-atelier-pres",
    title: "Atelier North — spring line presentation",
    accountKey: "ds-ateliernorth",
    startsAt: et("2026-03-10T15:00"),
    endsAt: et("2026-03-10T16:00"),
    location: "Atelier North Design, 712 Tucker St, Raleigh, NC",
    prepNotes: "Sofia's team — present the texture family + room scenes. They asked for Walnut Grain samples last week; bring extras.",
    status: "scheduled",
  },
];
