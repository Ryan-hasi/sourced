/**
 * /api/v1/chain — chain-as-a-service: every API key owns a hash-chained
 * transparency log, publicly readable, writable only with the key.
 *
 *   POST  (Bearer sk_src_…)  { payload }        → appends, returns the record
 *   GET   ?chain=<chainId>                      → meta: seq, head, ts, months
 *   GET   ?chain=<chainId>&month=YYYY-MM        → that month's records
 *   GET   ?chain=<chainId>&full=1               → all records (whole history)
 *
 * chainId = sha256(key) truncated — public and unguessable; publishing it
 * never exposes the key. Records live in monthly buckets; verification
 * needs the FULL history from genesis (?full=1), exactly like Tickwire's
 * chain at tickwire.news/api/sourced.
 */
import { append } from "../_log.mjs";
import { resolveCaller, rateLimit, stamp, chainIdOf, TIERS } from "../_auth.mjs";
import { kvGet, kvSet, kvSAdd } from "../_kv.mjs";

const MAX_PAYLOAD_BYTES = 32_000;
const MAX_RECORDS_PER_MONTH = 5_000;

const metaKey = (cid) => `sourced:chain:${cid}:meta`;
const monthKey = (cid, m) => `sourced:chain:${cid}:${m}`;
const monthOf = (ts) => new Date(ts).toISOString().slice(0, 7);

async function readJson(key, fallback) {
  try { return JSON.parse((await kvGet(key)) ?? "null") ?? fallback; } catch { return fallback; }
}

function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > MAX_PAYLOAD_BYTES + 4_000) reject(new Error(`payload too large (${MAX_PAYLOAD_BYTES / 1000} kB max)`));
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

  // ---- public read ---------------------------------------------------------
  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    const cid = (url.searchParams.get("chain") || "").replace(/[^a-f0-9]/g, "");
    if (!cid) {
      return res.status(400).json({
        error: "pass ?chain=<chainId> — chain ids are listed at /api/v1/chains",
        write: "POST { payload } with Authorization: Bearer sk_src_… appends to YOUR chain",
      });
    }
    const meta = await readJson(metaKey(cid), null);
    if (!meta) return res.status(404).json({ error: "unknown chain" });

    if (url.searchParams.get("full")) {
      const records = [];
      for (const m of meta.months) records.push(...(await readJson(monthKey(cid, m), [])));
      return res.status(200).json({ chainId: cid, records, verify: "https://sourced.network — or POST { chain } to /api/v1/verify" });
    }
    const month = url.searchParams.get("month");
    if (month) {
      if (!meta.months.includes(month)) return res.status(404).json({ error: "no records in that month", months: meta.months });
      return res.status(200).json({ chainId: cid, month, records: await readJson(monthKey(cid, month), []) });
    }
    return res.status(200).json({
      chainId: cid,
      name: meta.name,
      seq: meta.seq,
      head: meta.head,
      ts: meta.ts,
      months: meta.months,
      how: "?full=1 for the whole history, ?month=YYYY-MM for a bucket. Heads are anchored daily into public git history (github.com/Ryan-hasi/sourced/tree/main/anchors).",
    });
  }

  // ---- keyed append --------------------------------------------------------
  if (req.method !== "POST") return res.status(405).json({ error: "GET to read, POST to append" });

  const caller = await resolveCaller(req);
  if (caller.error) return res.status(caller.status).json({ error: caller.error });
  if (caller.tier !== "key") {
    return res.status(401).json({ error: "appending requires an API key — the chain is yours, so only you may write it" });
  }
  if (!(await rateLimit(req, res, caller, "append", TIERS.key.appendRpm))) return;

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }
  if (body?.payload === undefined) return res.status(400).json({ error: "send { payload: <any JSON you want committed> }" });

  const cid = chainIdOf(caller.sk);
  const ts = Date.now();
  const month = monthOf(ts);

  const meta = await readJson(metaKey(cid), { seq: -1, head: "", months: [], name: caller.meta.name });
  // append() derives seq/prevHash from the tail — hand it a minimal stand-in
  // for the (bucketed, possibly huge) chain instead of loading all of it.
  const tail = new Array(meta.seq + 1);
  if (meta.seq >= 0) tail[meta.seq] = { hash: meta.head };
  const record = append(tail, body.payload, ts);

  const records = await readJson(monthKey(cid, month), []);
  if (records.length >= MAX_RECORDS_PER_MONTH) {
    return res.status(429).json({ error: `chain bucket full (${MAX_RECORDS_PER_MONTH} records/month)` });
  }
  records.push(record);
  await kvSet(monthKey(cid, month), JSON.stringify(records));
  await kvSet(metaKey(cid), JSON.stringify({
    seq: record.seq,
    head: record.hash,
    ts,
    months: meta.months.includes(month) ? meta.months : [...meta.months, month],
    name: caller.meta.name,
  }));
  await kvSAdd("sourced:chains:index", cid);

  return res.status(200).json({
    chainId: cid,
    record,
    head: record.hash,
    public: `https://sourced.run/api/v1/chain?chain=${cid}`,
    anchored: "heads are committed daily into public git history — after that, not even we can rewrite yours",
  });
}
