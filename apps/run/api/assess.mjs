/**
 * POST /api/assess (canonical path: /api/v1/assess) — the Sourced primitive
 * as a hosted endpoint.
 * Body: { claims: [{id,title,origin,publishedAt}], clusters?, config? }
 *
 * Anonymous: corroboration is computed WITHIN the submitted batch.
 * With an API key (Authorization: Bearer sk_src_…): the call reads and
 * writes the key's persistent event store — firstSeenAt is real, and
 * corroboration accumulates ACROSS requests, exactly like running
 * @sourcedhq/core with your own store.
 */
import { assess } from "./_core.mjs";
import { resolveCaller, rateLimit, stamp, chainIdOf, TIERS } from "./_auth.mjs";
import { kvGet, kvSet, kvConfigured } from "./_kv.mjs";

const STORE_TTL_SEC = 14 * 24 * 3600; // rolling — core itself retires events after 36 h

const MAX_CLAIMS = 200;
// Numeric knobs only, clamped to sane ranges. The defaults are the contract.
const CONFIG_KEYS = {
  mergeSimilarity: [0.3, 1],
  minSharedTokens: [1, 10],
  confirmedAt: [2, 20],
  corroboratedAt: [2, 20],
  breakingWindowMs: [60_000, 24 * 3_600_000],
  receiptsCap: [1, 20],
  keyTokens: [3, 16],
};

function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 200_000) reject(new Error("payload too large (200 kB max)"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { reject(new Error("invalid JSON")); }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Sourced-Key");
  stamp(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const caller = await resolveCaller(req);
  if (caller.error) return res.status(caller.status).json({ error: caller.error });

  if (req.method === "GET") {
    return res.status(200).json({
      what: "Sourced — corroboration as a primitive. Confirmed by sources, never 'true'.",
      use: "POST { claims: [{ id, title, origin, publishedAt }] } — verdicts come back in order.",
      verdict: "{ corroboration, corroboratingSources, firstSeenAt, signal: confirmed|breaking|developing|null }",
      limits: `${MAX_CLAIMS} claims per call, 200 kB body, ${TIERS[caller.tier].rpm} requests/minute (${caller.tier} tier)`,
      memory: caller.tier === "key" ? "persistent — verdicts accumulate across your requests" : "batch-scoped — add an API key for persistent memory",
      you: caller.tier === "key" ? { key: caller.meta.name, chainId: chainIdOf(caller.sk) } : undefined,
      spec: "https://sourced.ink",
      proof: "https://sourced.network",
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST a batch of claims" });
  if (!(await rateLimit(req, res, caller))) return;

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }

  const raw = body?.claims;
  if (!Array.isArray(raw) || raw.length === 0) return res.status(400).json({ error: "claims must be a non-empty array" });
  if (raw.length > MAX_CLAIMS) return res.status(400).json({ error: `max ${MAX_CLAIMS} claims per call` });

  const claims = raw.map((c, i) => ({
    id: String(c?.id ?? `claim-${i}`),
    title: String(c?.title ?? ""),
    origin: String(c?.origin ?? "unknown"),
    publishedAt: String(c?.publishedAt ?? ""),
  }));

  const config = {};
  if (body?.config && typeof body.config === "object") {
    for (const [k, [lo, hi]] of Object.entries(CONFIG_KEYS)) {
      const v = Number(body.config[k]);
      if (Number.isFinite(v)) config[k] = Math.min(hi, Math.max(lo, v));
    }
  }

  let clusters;
  if (body?.clusters && typeof body.clusters === "object" && !Array.isArray(body.clusters)) {
    clusters = {};
    for (const [id, origins] of Object.entries(body.clusters)) {
      if (Array.isArray(origins)) clusters[id] = origins.map(String).slice(0, 100);
    }
  }

  // Keyed callers get a persistent event store — the whole point of a key.
  let store;
  if (caller.tier === "key") {
    const storeKey = `sourced:store:${chainIdOf(caller.sk)}`;
    store = {
      async load() {
        try { return JSON.parse((await kvGet(storeKey)) ?? "{}"); } catch { return {}; }
      },
      async save(events) {
        try { await kvSet(storeKey, JSON.stringify(events), STORE_TTL_SEC); } catch { /* fail open */ }
      },
    };
  }

  const verdicts = await assess(claims, { clusters, config, store, now: Date.now() });
  return res.status(200).json({
    verdicts,
    engine: "@sourcedhq/core",
    memory: caller.tier === "key" ? (kvConfigured ? "persistent" : "volatile (store not provisioned)") : "batch",
    honest: "corroborated, never 'true' — guarantees G1–G7 at https://sourced.ink",
    config: Object.keys(config).length ? config : undefined,
  });
}
