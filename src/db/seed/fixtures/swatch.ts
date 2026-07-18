/** Deterministic SVG swatch generator — one per SKU (docs/04 §1). */
import type { CatalogEntry } from "../data/catalog";

export function swatchSvg(entry: CatalogEntry): string {
  const c = entry.swatchColor;
  const pattern = patternFor(entry.swatchPattern, c);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>${pattern.defs}</defs>
  <rect width="320" height="320" fill="${c}"/>
  ${pattern.body}
  <rect width="320" height="320" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>
</svg>`;
}

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const adj = (x: number) => Math.max(0, Math.min(255, Math.round(x + (pct / 100) * 255)));
  const r = adj((n >> 16) & 255);
  const g = adj((n >> 8) & 255);
  const b = adj(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function patternFor(kind: CatalogEntry["swatchPattern"], c: string): { defs: string; body: string } {
  switch (kind) {
    case "grain": {
      let body = "";
      for (let i = 0; i < 12; i++) {
        const x = 8 + i * 27;
        const w = 2 + (i % 3);
        body += `<rect x="${x}" y="0" width="${w}" height="320" fill="${shade(c, i % 2 === 0 ? -12 : 8)}" opacity="0.5"/>`;
        if (i % 4 === 1) {
          body += `<ellipse cx="${x + 40}" cy="${60 + i * 20}" rx="26" ry="9" fill="none" stroke="${shade(c, -18)}" stroke-width="1.5" opacity="0.5"/>`;
        }
      }
      return { defs: "", body };
    }
    case "brushed": {
      let body = "";
      for (let i = 0; i < 64; i++) {
        body += `<rect x="0" y="${i * 5}" width="320" height="1" fill="${shade(c, i % 2 === 0 ? 10 : -8)}" opacity="0.35"/>`;
      }
      body += `<rect x="0" y="0" width="320" height="120" fill="white" opacity="0.06"/>`;
      return { defs: "", body };
    }
    case "veined": {
      const v = shade(c, c > "#888888" ? -25 : 25);
      const body = `
        <path d="M-10,60 C80,90 120,20 200,70 S300,120 340,90" fill="none" stroke="${v}" stroke-width="2.5" opacity="0.6"/>
        <path d="M-10,180 C60,150 150,220 230,180 S320,150 340,190" fill="none" stroke="${v}" stroke-width="1.8" opacity="0.5"/>
        <path d="M40,-10 C60,80 30,160 70,240 S60,300 90,330" fill="none" stroke="${v}" stroke-width="1.2" opacity="0.4"/>`;
      return { defs: "", body };
    }
    case "woven": {
      let body = "";
      for (let i = 0; i < 20; i++) {
        body += `<rect x="0" y="${i * 16}" width="320" height="7" fill="${shade(c, -10)}" opacity="0.35"/>`;
        body += `<rect x="${i * 16}" y="0" width="7" height="320" fill="${shade(c, 8)}" opacity="0.3"/>`;
      }
      return { defs: "", body };
    }
    case "flat":
    default:
      return {
        defs: "",
        body: `<rect x="0" y="0" width="320" height="160" fill="white" opacity="0.04"/><rect x="0" y="240" width="320" height="80" fill="black" opacity="0.06"/>`,
      };
  }
}

/** The two seeded room "photos" for the scene studio (lobby, conference). */
export function roomPhotoSvg(kind: "lobby" | "conference"): string {
  if (kind === "lobby") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <rect width="1280" height="800" fill="#15151a"/>
  <rect x="0" y="560" width="1280" height="240" fill="#1f1f24"/>
  <rect x="120" y="90" width="620" height="470" fill="#2b2b31"/>
  <rect x="790" y="110" width="150" height="450" fill="#343d45"/>
  <rect x="960" y="110" width="150" height="450" fill="#343d45"/>
  <rect x="300" y="470" width="420" height="130" rx="6" fill="#232327"/>
  <rect x="200" y="46" width="360" height="8" rx="4" fill="#efe9dd" opacity="0.8"/>
  <rect x="640" y="46" width="360" height="8" rx="4" fill="#efe9dd" opacity="0.55"/>
  <text x="128" y="740" font-family="monospace" font-size="20" fill="#6d6d76">customer lobby — feature wall + reception desk</text>
</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <rect width="1280" height="800" fill="#131318"/>
  <rect x="0" y="540" width="1280" height="260" fill="#1d1d22"/>
  <rect x="90" y="80" width="1100" height="460" fill="#26262c"/>
  <ellipse cx="640" cy="600" rx="330" ry="70" fill="#2e2e34"/>
  <rect x="560" y="120" width="220" height="300" rx="4" fill="#0f0f12"/>
  <text x="100" y="740" font-family="monospace" font-size="20" fill="#6d6d76">conference room — end wall + table</text>
</svg>`;
}
