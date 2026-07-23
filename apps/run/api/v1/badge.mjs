/**
 * GET /api/v1/badge — Official Sourced SVG Badge Generator.
 *
 * Query params:
 *   - corro: corroboration count (default: 2)
 *   - signal: "confirmed" | "breaking" | "developing" | "bare"
 *   - sources: comma-separated list of receipts (e.g. "reuters,bloomberg")
 *   - hash: Merkle chain hash snippet (e.g. "e2a1cb7")
 *
 * Returns: image/svg+xml
 */
import { stamp } from "../_auth.mjs";

export default function handler(req, res) {
  if (!res.status) res.status = (c) => { res.statusCode = c; return res; };
  if (!res.send) res.send = (body) => { res.end(body); return res; };

  stamp(res);
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");

  const url = new URL(req.url, "http://x");
  const corro = Math.max(1, parseInt(url.searchParams.get("corro") || "2", 10));
  const signal = (url.searchParams.get("signal") || (corro >= 4 ? "confirmed" : corro >= 2 ? "breaking" : "bare")).toLowerCase();
  const rawSources = url.searchParams.get("sources") || "";
  const sources = rawSources ? rawSources.split(",").slice(0, 3).join(", ") : "";
  const hash = (url.searchParams.get("hash") || "verified").slice(0, 10);

  const TRADEMARK_RED_DOT = "#d4111e";
  const statusLabel = signal === "confirmed" ? "CONFIRMED" : signal === "breaking" ? "BREAKING" : signal === "developing" ? "DEVELOPING" : "SINGLE SOURCE";

  const width = 420;
  const height = 120;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <style>
    .bg { fill: #0D0F12; rx: 12px; stroke: #1F242D; stroke-width: 1.5; }
    .brand { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; font-weight: 700; fill: #8B949E; letter-spacing: 1.5px; }
    .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 16px; font-weight: 700; fill: #F0F6FC; }
    .receipts { font-family: "JetBrains Mono", monospace, sans-serif; font-size: 12px; fill: #C9D1D9; }
    .hash { font-family: "JetBrains Mono", monospace, sans-serif; font-size: 10px; fill: #6E7681; }
    .badge-tag { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; font-weight: 800; fill: #8B949E; letter-spacing: 1px; }
  </style>
  <rect width="${width}" height="${height}" class="bg" />
  
  <!-- Header row with trademark crimson red dot -->
  <circle cx="24" cy="24" r="5" fill="${TRADEMARK_RED_DOT}" />
  <text x="36" y="28" class="brand">SOURCED // ${statusLabel}</text>
  <text x="${width - 24}" y="28" class="hash" text-anchor="end">CHAIN #${hash}</text>
  
  <!-- Divider -->
  <line x1="24" y1="40" x2="${width - 24}" y2="40" stroke="#161B22" stroke-width="1" />
  
  <!-- Body -->
  <text x="24" y="64" class="title">${corro} Independent ${corro === 1 ? "Origin" : "Origins"} Corroborated</text>
  <text x="24" y="86" class="receipts">${sources ? `Receipts: ${sources}` : "Single source report — no receipts"}</text>
  <text x="24" y="104" class="hash">Honesty Guarantee G1-G7 · sourced.network</text>
</svg>
`.trim();

  res.status(200).send(svg);
}
