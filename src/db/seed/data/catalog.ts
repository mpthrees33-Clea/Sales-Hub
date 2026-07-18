/**
 * The ~60-SKU catalog (docs/04 §1): wood grains, metals, stones/concretes,
 * solids, textures. Hand-authored names + deterministic specs, inventory,
 * and three price tiers. Hero SKU: MS-WG-1147 "Walnut Grain".
 */
import { shash } from "../ids";

export type CatalogEntry = {
  sku: string;
  name: string;
  family: "wood" | "metal" | "stone" | "solid" | "texture";
  finish: string;
  description: string;
  swatchColor: string;
  swatchPattern: "grain" | "brushed" | "veined" | "flat" | "woven";
  unit: string;
  listPriceCents: number;
  minQty: number;
  onHand: number;
  leadTimeDays: number;
  fireRating: string;
};

type FamilyDef = {
  family: CatalogEntry["family"];
  prefix: string;
  finish: (name: string) => string;
  pattern: CatalogEntry["swatchPattern"];
  basePriceCents: number;
  entries: { name: string; color: string; num?: number }[];
};

const FAMILIES: FamilyDef[] = [
  {
    family: "wood",
    prefix: "MS-WG",
    finish: () => "Satin wood grain",
    pattern: "grain",
    basePriceCents: 84_500,
    entries: [
      { name: "Walnut Grain", color: "#6b4a2f", num: 1147 },
      { name: "White Oak", color: "#c9b189" },
      { name: "Teak", color: "#8a5a33" },
      { name: "Cherry", color: "#7e3b2a" },
      { name: "Maple", color: "#d4b98c" },
      { name: "Ash Grey", color: "#a89f93" },
      { name: "Ebony", color: "#2a211c" },
      { name: "Rift Oak", color: "#b59a72" },
      { name: "Smoked Oak", color: "#6e5843" },
      { name: "Birch", color: "#e0cba6" },
      { name: "Hickory", color: "#9a7448" },
      { name: "Mahogany", color: "#5e3222" },
      { name: "Zebrano", color: "#a88452" },
      { name: "Wenge", color: "#40302a" },
      { name: "Carbonized Bamboo", color: "#8f7146" },
      { name: "Nordic Larch", color: "#c8a877" },
      { name: "Aromatic Cedar", color: "#9c6242" },
      { name: "Driftwood", color: "#9d9184" },
    ],
  },
  {
    family: "metal",
    prefix: "MS-MT",
    finish: (n) => (n.includes("Brushed") || n.includes("Satin") ? "Brushed metal" : "Patina metal"),
    pattern: "brushed",
    basePriceCents: 112_000,
    entries: [
      { name: "Brushed Steel", color: "#9ba1a6" },
      { name: "Bronze", color: "#8c6a3f" },
      { name: "Champagne Gold", color: "#c9ae7e" },
      { name: "Gunmetal", color: "#4c5258" },
      { name: "Copper Patina", color: "#4e8a72" },
      { name: "Satin Aluminum", color: "#b8bcc0" },
      { name: "Blackened Iron", color: "#33363a" },
      { name: "Pewter", color: "#7d8187" },
      { name: "Titanium", color: "#a7abb3" },
      { name: "Antique Brass", color: "#9a7d4a" },
      { name: "Corten Weathered", color: "#8a4f30" },
      { name: "Mirror Chrome", color: "#c9ced4" },
    ],
  },
  {
    family: "stone",
    prefix: "MS-ST",
    finish: () => "Honed stone",
    pattern: "veined",
    basePriceCents: 96_500,
    entries: [
      { name: "Carrara Marble", color: "#dcdcda" },
      { name: "Nero Marquina", color: "#26262a" },
      { name: "Travertine", color: "#c9b699" },
      { name: "Slate", color: "#4c525a" },
      { name: "Concrete Cast", color: "#9a9a98" },
      { name: "Sandstone", color: "#c3a982" },
      { name: "Terrazzo Fleck", color: "#b9b3ac" },
      { name: "Basalt", color: "#3b3f44" },
      { name: "Limestone", color: "#cfc4ad" },
      { name: "Onyx Smoke", color: "#5c5350" },
    ],
  },
  {
    family: "solid",
    prefix: "MS-SD",
    finish: () => "Matte solid",
    pattern: "flat",
    basePriceCents: 62_000,
    entries: [
      { name: "Matte White", color: "#f0efec" },
      { name: "Ivory", color: "#e8e0cd" },
      { name: "Graphite", color: "#3f4145" },
      { name: "Charcoal", color: "#2c2e31" },
      { name: "Storm Grey", color: "#71767d" },
      { name: "Sage", color: "#8fa08a" },
      { name: "Deep Navy", color: "#25324a" },
      { name: "Terracotta", color: "#b0603f" },
      { name: "Blush Clay", color: "#c69a8b" },
      { name: "Jet Black", color: "#151517" },
    ],
  },
  {
    family: "texture",
    prefix: "MS-TX",
    finish: () => "Tactile texture",
    pattern: "woven",
    basePriceCents: 78_500,
    entries: [
      { name: "Linen Weave", color: "#cfc4ae" },
      { name: "Raw Silk", color: "#c0ab8e" },
      { name: "Leather Grain", color: "#7a4f33" },
      { name: "Rattan", color: "#b28e58" },
      { name: "Boucle Cloud", color: "#d3cec4" },
      { name: "Hammered Relief", color: "#8e9297" },
      { name: "Brushed Canvas", color: "#b5aa95" },
      { name: "Natural Cork", color: "#b3844f" },
      { name: "Felt Grey", color: "#84838b" },
      { name: "Woven Steel", color: "#6d7580" },
    ],
  },
];

function buildCatalog(): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const fam of FAMILIES) {
    fam.entries.forEach((e) => {
      const num = e.num ?? 1100 + shash(`${fam.prefix}:${e.name}`, 800);
      const sku = `${fam.prefix}-${num}`;
      const priceJitter = (shash(`price:${sku}`, 21) - 10) * 1000; // ±$100
      const fireRating = shash(`fire:${sku}`, 5) === 0 ? "Class B" : "Class A (ASTM E84)";
      out.push({
        sku,
        name: e.name,
        family: fam.family,
        finish: fam.finish(e.name),
        description: `${e.name} architectural film — ${fam.finish(e.name).toLowerCase()}, ${fireRating} fire rating, self-adhesive, for interior vertical and casework surfaces.`,
        swatchColor: e.color,
        swatchPattern: fam.pattern,
        unit: "roll",
        listPriceCents: fam.basePriceCents + priceJitter,
        minQty: shash(`minqty:${sku}`, 6) === 0 ? 5 : 1,
        onHand: 8 + shash(`stock:${sku}`, 140),
        leadTimeDays: 5 + shash(`lead:${sku}`, 17),
        fireRating,
      });
    });
  }
  // De-dupe any hash-collided SKUs deterministically.
  const seen = new Set<string>();
  return out.map((e) => {
    let sku = e.sku;
    let bump = 0;
    while (seen.has(sku)) {
      bump += 1;
      sku = `${e.sku.slice(0, -1)}${(parseInt(e.sku.slice(-1), 10) + bump) % 10}`;
    }
    seen.add(sku);
    return { ...e, sku };
  });
}

export const CATALOG: CatalogEntry[] = buildCatalog();

export const HERO = CATALOG.find((c) => c.sku === "MS-WG-1147")!;

/** Deterministic lookup by name (fixtures reference SKUs via this). */
export function skuOf(name: string): string {
  const hit = CATALOG.find((c) => c.name === name);
  if (!hit) throw new Error(`catalog: no product named "${name}"`);
  return hit.sku;
}

export const TIER_MULTIPLIERS = { list: 1, distributor: 0.78, project: 0.88 } as const;

export function tierPriceCents(listPriceCents: number, tier: keyof typeof TIER_MULTIPLIERS): number {
  return Math.round((listPriceCents * TIER_MULTIPLIERS[tier]) / 100) * 100;
}
