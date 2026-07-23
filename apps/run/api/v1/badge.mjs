/**
 * GET /api/v1/badge — Official Sourced Checkmark Badge (& Receipt Card) Generator.
 *
 * Implements the standardized "✓ SOURCED" trust mark specification (Sourced Book, Ch. 20).
 *
 * Query params:
 *   - corro: corroboration count (default: 2)
 *   - signal: "confirmed" | "breaking" | "developing" | "bare"
 *   - sources: comma-separated list of receipts (e.g. "reuters,bloomberg")
 *   - hash: Merkle chain hash snippet (e.g. "e2a1cb7")
 *   - variant: "mark" (standard 152x32 badge) | "card" (full receipt card)
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
  const variant = url.searchParams.get("variant") || "mark";

  // Official standardized 152x32 Checkmark Badge ("✓ SOURCED") — Sourced Book Ch. 20
  if (variant === "mark") {
    const markSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="152" height="32" role="img" aria-label="Sourced-conformant">
  <rect x="0.5" y="0.5" width="151" height="31" rx="6.5" fill="#0a0a0a" stroke="#33333a"/>
  <text x="22" y="20.5" font-family="ui-monospace,'Cascadia Code',Menlo,Consolas,monospace" font-size="12" font-weight="700" letter-spacing="1.6" fill="#ededed">&#10003; SOURCED</text>
</svg>
`.trim();
    return res.status(200).send(markSvg);
  }

  // Full Sourced Receipt Card with official "✓ SOURCED" lockup
  const corro = Math.max(1, parseInt(url.searchParams.get("corro") || "2", 10));
  const signal = (url.searchParams.get("signal") || (corro >= 4 ? "confirmed" : corro >= 2 ? "breaking" : "bare")).toLowerCase();
  const rawSources = url.searchParams.get("sources") || "";
  const sources = rawSources ? rawSources.split(",").slice(0, 3).join(", ") : "";
  const hash = (url.searchParams.get("hash") || "verified").slice(0, 10);

  const statusLabel = signal === "confirmed" ? "CONFIRMED" : signal === "breaking" ? "BREAKING" : signal === "developing" ? "DEVELOPING" : "SINGLE SOURCE";

  const width = 420;
  const height = 120;

  const cardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-label="Sourced Verification Receipt">
  <style>
    .bg { fill: #0a0a0a; rx: 8px; stroke: #33333a; stroke-width: 1; }
    .brand { font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; font-size: 12px; font-weight: 700; fill: #ededed; letter-spacing: 1.6px; }
    .status { font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; font-size: 10px; font-weight: 700; fill: #8B949E; letter-spacing: 1px; }
    .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 15px; font-weight: 700; fill: #F0F6FC; }
    .receipts { font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; font-size: 12px; fill: #C9D1D9; }
    .hash { font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; font-size: 10px; fill: #6E7681; }
  </style>
  <rect width="${width}" height="${height}" class="bg" />
  
  <!-- Official Checkmark Brand Header (No dot) -->
  <text x="20" y="26" class="brand">&#10003; SOURCED</text>
  <text x="130" y="26" class="status">// ${statusLabel}</text>
  <text x="${width - 20}" y="26" class="hash" text-anchor="end">CHAIN #${hash}</text>
  
  <!-- Divider -->
  <line x1="20" y1="38" x2="${width - 20}" y2="38" stroke="#1f1f24" stroke-width="1" />
  
  <!-- Body -->
  <text x="20" y="62" class="title">${corro} Independent ${corro === 1 ? "Origin" : "Origins"} Corroborated</text>
  <text x="20" y="84" class="receipts">${sources ? `Receipts: ${sources}` : "Single source report — unconfirmed"}</text>
  <text x="20" y="104" class="hash">Honesty Guarantee G1-G7 · sourced.network</text>
</svg>
`.trim();

  res.status(200).send(cardSvg);
}
