/**
 * POST /api/verify — verify a Sourced transparency chain.
 * Body: { chain: LogRecord[] } or raw JSONL text ({ jsonl: "…" }).
 * Optionally { payload, seq } to prove a payload's inclusion at a position.
 */
import { verify, verifyPayloadAt } from "./_log.mjs";

function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 2_000_000) reject(new Error("payload too large (2 MB max)"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { reject(new Error("invalid JSON")); }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST a chain" });

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }

  let chain = body?.chain;
  if (!chain && typeof body?.jsonl === "string") {
    try {
      chain = body.jsonl.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    } catch {
      return res.status(400).json({ error: "jsonl lines must each be a JSON record" });
    }
  }
  if (!Array.isArray(chain)) return res.status(400).json({ error: "send { chain: [...] } or { jsonl: '...' }" });
  if (chain.length > 100_000) return res.status(400).json({ error: "chain too long for the hosted verifier" });

  const result = verify(chain);
  const out = { ...result };
  if (result.ok && body?.payload !== undefined && Number.isInteger(body?.seq)) {
    out.payloadIncluded = verifyPayloadAt(chain, body.seq, body.payload);
    out.seq = body.seq;
  }
  res.status(200).json(out);
}
