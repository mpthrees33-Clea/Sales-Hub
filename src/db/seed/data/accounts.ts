/**
 * The 40-account territory (docs/04 §1): 12 GCs, 10 architecture/design
 * firms, 8 distributors, 10 facility owners/others across Charlotte /
 * Raleigh / Greensboro. All company names fictional; all domains use
 * .example.com-style TLDs reserved for demos. Hero accounts (used by the
 * staged Monday batch) are hand-authored with named contacts.
 */
import { shash } from "../ids";

export type SeedContact = { name: string; email: string; role: string; phone?: string };

export type SeedAccount = {
  key: string; // stable id key
  name: string;
  type: "gc" | "architect" | "designer" | "distributor" | "owner";
  metro: "charlotte" | "raleigh" | "greensboro";
  address: { line1: string; city: string; state: string; zip: string };
  lat: number;
  lng: number;
  tier: "list" | "distributor" | "project";
  domain: string;
  contacts: SeedContact[];
};

const METROS = {
  charlotte: { lat: 35.2271, lng: -80.8431, city: "Charlotte", zips: ["28202", "28203", "28204", "28217", "28273"] },
  raleigh: { lat: 35.7796, lng: -78.6382, city: "Raleigh", zips: ["27601", "27603", "27606", "27609", "27617"] },
  greensboro: { lat: 36.0726, lng: -79.792, city: "Greensboro", zips: ["27401", "27403", "27407", "27409", "27455"] },
} as const;

function geo(metro: keyof typeof METROS, key: string): { lat: number; lng: number } {
  const m = METROS[metro];
  return {
    lat: m.lat + (shash(`lat:${key}`, 2000) - 1000) / 12_000,
    lng: m.lng + (shash(`lng:${key}`, 2000) - 1000) / 10_000,
  };
}

function addr(metro: keyof typeof METROS, key: string): SeedAccount["address"] {
  const m = METROS[metro];
  const streets = ["Trade St", "Commerce Dr", "Meridian Pkwy", "Ironworks Ave", "Foundry Rd", "Market St", "Summit Blvd", "Harding Pl"];
  return {
    line1: `${200 + shash(`num:${key}`, 4800)} ${streets[shash(`street:${key}`, streets.length)]!}`,
    city: m.city,
    state: "NC",
    zip: m.zips[shash(`zip:${key}`, m.zips.length)]!,
  };
}

function domainFor(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .join("") + ".example.com"
  );
}

function contactEmail(name: string, domain: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z ]/g, "")
      .split(" ")
      .join(".") + `@${domain}`
  );
}

function mk(
  key: string,
  name: string,
  type: SeedAccount["type"],
  metro: keyof typeof METROS,
  contactDefs: { name: string; role: string }[],
): SeedAccount {
  const domain = domainFor(name);
  const tier: SeedAccount["tier"] = type === "distributor" ? "distributor" : type === "gc" ? "project" : "list";
  return {
    key,
    name,
    type,
    metro,
    address: addr(metro, key),
    ...geo(metro, key),
    tier,
    domain,
    contacts: contactDefs.map((c) => ({
      name: c.name,
      role: c.role,
      email: contactEmail(c.name, domain),
      phone: `(984) 555-0${100 + shash(`ph:${key}:${c.name}`, 900)}`,
    })),
  };
}

// ── Hero accounts (staged Monday batch references these) ─────────────────────

export const ACCOUNTS: SeedAccount[] = [
  // GCs (12)
  mk("gc-stonebridge", "Stonebridge Construction Group", "gc", "charlotte", [
    { name: "Marcus Hale", role: "Senior Estimator" },
    { name: "Alicia Grant", role: "Project Manager" },
  ]),
  mk("gc-crestline", "Crestline Builders", "gc", "raleigh", [
    { name: "Priya Nair", role: "Preconstruction Manager" },
    { name: "Tom Brescia", role: "Superintendent" },
  ]),
  mk("gc-whitaker", "Whitaker Commercial Contractors", "gc", "charlotte", [
    { name: "Ray Delgado", role: "Project Executive" },
    { name: "Jenna Fox", role: "Project Engineer" },
  ]),
  mk("gc-hartwell", "Hartwell & Frame", "gc", "greensboro", [{ name: "Owen Pierce", role: "Estimator" }]),
  mk("gc-bluffline", "Bluffline Construction", "gc", "charlotte", [{ name: "Dana Kwon", role: "PM" }]),
  mk("gc-keystone", "Keystone Interiors Group", "gc", "raleigh", [
    { name: "Miles Overton", role: "Interiors PM" },
    { name: "Sara Whitley", role: "APM" },
  ]),
  mk("gc-ironhill", "Ironhill Constructors", "gc", "greensboro", [{ name: "Victor Ames", role: "Estimator" }]),
  mk("gc-lattice", "Lattice Build Co", "gc", "charlotte", [{ name: "Noah Redding", role: "PM" }]),
  mk("gc-summitpark", "Summit Park Builders", "gc", "raleigh", [{ name: "Elise Tran", role: "Precon Lead" }]),
  mk("gc-gatewood", "Gatewood Construction", "gc", "greensboro", [{ name: "Hank Sorrell", role: "PX" }]),
  mk("gc-redoak", "Red Oak Commercial", "gc", "charlotte", [{ name: "Imani Wells", role: "PM" }]),
  mk("gc-truenorth", "TrueNorth Builders", "gc", "raleigh", [{ name: "Caleb Munn", role: "Estimator" }]),

  // Architecture / design (10)
  mk("ar-merrow", "Merrow Architecture", "architect", "charlotte", [
    { name: "Lauren Tate", role: "Associate Principal" },
  ]),
  mk("ar-calder", "Calder Design Partners", "architect", "raleigh", [
    { name: "Ben Osei", role: "Spec Writer" },
    { name: "Rita Calder", role: "Principal" },
  ]),
  mk("ds-ateliernorth", "Atelier North Design", "designer", "raleigh", [
    { name: "Sofia Marino", role: "Senior Interior Designer" },
    { name: "Grace Lin", role: "Studio Coordinator" },
  ]),
  mk("ds-fostervale", "Foster & Vale Interiors", "designer", "charlotte", [
    { name: "Jordan Ellery", role: "Design Director" },
  ]),
  mk("ar-pellhouse", "Pell House Architects", "architect", "greensboro", [{ name: "Marta Voss", role: "PA" }]),
  mk("ar-fieldstone", "Fieldstone Architecture", "architect", "charlotte", [{ name: "Drew Calloway", role: "PA" }]),
  mk("ds-halcyon", "Halcyon Studio", "designer", "raleigh", [{ name: "Nina Brandt", role: "Designer" }]),
  mk("ar-arcline", "Arcline Collective", "architect", "greensboro", [{ name: "Peter Shao", role: "Spec Lead" }]),
  mk("ds-vantage", "Vantage Interior Group", "designer", "charlotte", [{ name: "Kayla Dunn", role: "Designer" }]),
  mk("ar-northloop", "North Loop Architects", "architect", "raleigh", [{ name: "Gil Ferris", role: "PA" }]),

  // Distributors (8)
  mk("di-piedmont", "Piedmont Surface Distribution", "distributor", "charlotte", [
    { name: "Dana Whitfield", role: "Purchasing Manager" },
    { name: "Chris Yoder", role: "Inside Sales" },
  ]),
  mk("di-carolina", "Carolina Architectural Products", "distributor", "raleigh", [
    { name: "Evan Ross", role: "Branch Manager" },
    { name: "Molly Sutter", role: "Purchasing" },
  ]),
  mk("di-tristate", "Tri-State Surface Supply", "distributor", "greensboro", [{ name: "Walt Griggs", role: "Buyer" }]),
  mk("di-metrolina", "Metrolina Finishes", "distributor", "charlotte", [{ name: "Ana Cabrera", role: "Purchasing" }]),
  mk("di-capital", "Capital Interior Supply", "distributor", "raleigh", [{ name: "Reid Palmer", role: "Buyer" }]),
  mk("di-gatecity", "Gate City Distribution", "distributor", "greensboro", [{ name: "Faye Holt", role: "Ops Manager" }]),
  mk("di-southern", "Southern Film & Surface", "distributor", "charlotte", [{ name: "Leo Marsh", role: "Buyer" }]),
  mk("di-eastfork", "East Fork Building Products", "distributor", "raleigh", [{ name: "June Park", role: "Purchasing" }]),

  // Owners / other (10)
  mk("ow-harborview", "Harborview Health System", "owner", "charlotte", [
    { name: "Diane Keller", role: "Facilities Director" },
  ]),
  mk("ow-pinnacle", "Pinnacle Hospitality Group", "owner", "raleigh", [{ name: "Marco Reyes", role: "VP Facilities" }]),
  mk("ow-cardinal", "Cardinal Properties", "owner", "charlotte", [{ name: "Beth Nolan", role: "Asset Manager" }]),
  mk("ow-triangle", "Triangle Medical Realty", "owner", "raleigh", [{ name: "Sam Okafor", role: "Facilities" }]),
  mk("ow-crownridge", "Crownridge Hotels", "owner", "greensboro", [{ name: "Ivy Chen", role: "Design Manager" }]),
  mk("ow-stateline", "Stateline Campus Services", "owner", "charlotte", [{ name: "Rob Tatum", role: "Facilities" }]),
  mk("ow-oakcity", "Oak City Offices", "owner", "raleigh", [{ name: "Wendy Salazar", role: "Property Manager" }]),
  mk("ow-guilford", "Guilford Civic Trust", "owner", "greensboro", [{ name: "Al Freeman", role: "Facilities" }]),
  mk("ow-lakemont", "Lakemont Senior Living", "owner", "charlotte", [{ name: "Tess Marlow", role: "Facilities" }]),
  mk("ow-bristol", "Bristol Retail Partners", "owner", "greensboro", [{ name: "Gary Ines", role: "Construction Mgr" }]),
];

export function accountByKey(key: string): SeedAccount {
  const a = ACCOUNTS.find((x) => x.key === key);
  if (!a) throw new Error(`seed: unknown account key ${key}`);
  return a;
}

export function contactOf(accountKey: string, contactName: string): SeedContact {
  const a = accountByKey(accountKey);
  const c = a.contacts.find((x) => x.name === contactName);
  if (!c) throw new Error(`seed: unknown contact ${contactName} at ${accountKey}`);
  return c;
}
