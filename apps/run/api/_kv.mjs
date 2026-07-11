/**
 * KV access for the hosted API — Upstash/Vercel KV over REST, zero deps.
 *
 * Falls back to an in-process Map when no KV env vars are present, so the
 * API keeps working (a) locally under scripts/dev-server.mjs and (b) in
 * production before the store is provisioned — persistence is then merely
 * per-instance and best-effort, which every consumer of this module treats
 * as acceptable degradation (fail open, G7).
 */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const kvConfigured = Boolean(URL_ && TOKEN);

// --- in-memory fallback ----------------------------------------------------
const mem = new Map(); // key -> { v: string, exp: number|null }
function memGet(key) {
  const e = mem.get(key);
  if (!e) return null;
  if (e.exp !== null && Date.now() > e.exp) { mem.delete(key); return null; }
  return e.v;
}

// --- Upstash REST -----------------------------------------------------------
async function cmd(args) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function pipeline(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(j?.error || "pipeline failed");
  return j.map((x) => x.result);
}

// --- public ops (strings in, strings out) -----------------------------------
export async function kvGet(key) {
  if (!kvConfigured) return memGet(key);
  return await cmd(["GET", key]);
}

export async function kvSet(key, value, ttlSec) {
  if (!kvConfigured) {
    mem.set(key, { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : null });
    return "OK";
  }
  return ttlSec ? cmd(["SET", key, value, "EX", String(ttlSec)]) : cmd(["SET", key, value]);
}

export async function kvDel(key) {
  if (!kvConfigured) return mem.delete(key) ? 1 : 0;
  return cmd(["DEL", key]);
}

/** INCR with a TTL set on first increment. Returns the new count. */
export async function kvIncrEx(key, ttlSec) {
  if (!kvConfigured) {
    const cur = Number(memGet(key) ?? "0") + 1;
    const prev = mem.get(key);
    mem.set(key, { v: String(cur), exp: prev?.exp ?? Date.now() + ttlSec * 1000 });
    return cur;
  }
  const [count] = await pipeline([["INCR", key], ["EXPIRE", key, String(ttlSec), "NX"]]);
  return Number(count);
}

export async function kvSAdd(key, member) {
  if (!kvConfigured) {
    const set = new Set(JSON.parse(memGet(key) ?? "[]"));
    set.add(member);
    mem.set(key, { v: JSON.stringify([...set]), exp: null });
    return 1;
  }
  return cmd(["SADD", key, member]);
}

export async function kvSRem(key, member) {
  if (!kvConfigured) {
    const set = new Set(JSON.parse(memGet(key) ?? "[]"));
    const had = set.delete(member);
    mem.set(key, { v: JSON.stringify([...set]), exp: null });
    return had ? 1 : 0;
  }
  return cmd(["SREM", key, member]);
}

export async function kvSMembers(key) {
  if (!kvConfigured) return JSON.parse(memGet(key) ?? "[]");
  return (await cmd(["SMEMBERS", key])) ?? [];
}
