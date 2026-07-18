/**
 * Demo ImageGenProvider — returns a deterministic composite rendered as SVG
 * (room line-art washed with the product finish on the named surfaces) after
 * a believable simulated delay. The two scripted hero scenes are seed
 * fixtures and never wait (WO-11 task 7).
 */
import { getBlobBuffer, putBlob } from "@/lib/blob";
import type { GenerateSceneInput, GenerateSceneResult, ImageGenProvider } from "./types";

const SIMULATED_DELAY_MS = 4500;

export class DemoImageGenProvider implements ImageGenProvider {
  async generateScene(input: GenerateSceneInput): Promise<GenerateSceneResult> {
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, SIMULATED_DELAY_MS));

    // Pull the dominant fill from the swatch SVG so the composite visibly
    // carries the chosen finish.
    let fill = "#8a6a4f";
    try {
      const swatch = (await getBlobBuffer(input.productSwatchUrl)).toString("utf8");
      const m = swatch.match(/fill="(#[0-9a-fA-F]{6})"/);
      if (m) fill = m[1]!;
    } catch {
      // keep default
    }
    const surfaces = input.targetSurfaces.join(", ") || "feature wall";
    const svg = compositeSceneSvg(fill, surfaces);
    const key = `scenes/generated-${hashString(JSON.stringify(input)).toString(16)}.svg`;
    const url = await putBlob(key, svg, { contentType: "image/svg+xml" });
    return { imageBlobUrl: url, model: "demo/fixture-composite", durationMs: Date.now() - t0 };
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function compositeSceneSvg(finishHex: string, surfacesLabel: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <defs>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#1a1a1d"/>
    </linearGradient>
    <linearGradient id="finish" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${finishHex}"/><stop offset="1" stop-color="${shade(finishHex, -28)}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d4750"/><stop offset="1" stop-color="#232a30"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="800" fill="#101013"/>
  <rect x="0" y="560" width="1280" height="240" fill="url(#floor)"/>
  <!-- feature wall carrying the applied finish -->
  <rect x="120" y="90" width="620" height="470" fill="url(#finish)"/>
  ${grain(finishHex)}
  <!-- side glazing -->
  <rect x="790" y="110" width="150" height="450" fill="url(#glass)"/>
  <rect x="960" y="110" width="150" height="450" fill="url(#glass)"/>
  <rect x="785" y="105" width="330" height="6" fill="#0a0a0c"/>
  <!-- reception desk -->
  <rect x="300" y="470" width="420" height="130" rx="6" fill="${shade(finishHex, -40)}"/>
  <rect x="300" y="462" width="420" height="12" rx="4" fill="#0e0e10"/>
  <!-- ceiling light coves -->
  <rect x="200" y="46" width="360" height="8" rx="4" fill="#f5efe6" opacity="0.85"/>
  <rect x="640" y="46" width="360" height="8" rx="4" fill="#f5efe6" opacity="0.6"/>
  <text x="128" y="740" font-family="monospace" font-size="22" fill="#8b8b92">applied finish · ${escapeXml(surfacesLabel)}</text>
  <text x="128" y="770" font-family="monospace" font-size="16" fill="#5c5c63">demo composite — live generation uses Gemini image model</text>
</svg>`;
}

function grain(hex: string): string {
  let out = "";
  for (let i = 0; i < 14; i++) {
    const x = 140 + i * 43;
    out += `<rect x="${x}" y="96" width="3" height="458" fill="${shade(hex, i % 2 === 0 ? -14 : 10)}" opacity="0.35"/>`;
  }
  return out;
}

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255)));
  const r = adj((n >> 16) & 255);
  const g = adj((n >> 8) & 255);
  const b = adj(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
