/**
 * API keys + rate limiting for sourced.run.
 *
 * Tiers:
 *   anon — no key, identified by IP.   Batch-scoped memory only.
 *   key  — Bearer sk_src_… key.        Persistent event memory + own chain.
 *
 * Rate limiting is a fixed one-minute window in KV; when KV is unreachable
 * it FAILS OPEN (the primitive must never be the reason a stream breaks).
 */
import { createHash } from "node:crypto";
import { kvGet, kvIncrEx } from "./_kv.mjs";

export const API_VERSION = "v1";
export const ENGINE = "@sourcedhq/core@1.0.0";

export const TIERS = {
  anon: { rpm: 60, appendRpm: 0 },
  key: { rpm: 600, appendRpm: 30 },
};

/** Public, unguessable chain/store id derived from a key. Never reversible. */
export function chainIdOf(sk) {
  return createHash("sha256").update(sk).digest("hex").slice(0, 16);
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Resolve the caller: `{ tier, id, sk?, meta? }` or `{ error, status }`.
 * A syntactically present but unknown/revoked key is a hard 401 — silently
 * downgrading a keyed caller to anonymous would be dishonest —
 * they were promised memory.
 */
export async function resolveCaller(req) {
  const auth = req.headers["authorization"] || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (req.headers["x-sourced-key"] || "").trim();
  if (!raw) return { tier: "anon", id: `ip:${clientIp(req)}` };
  if (!raw.startsWith("sk_src_")) return { error: "malformed key (expected sk_src_…)", status: 401 };
  let meta = null;
  try {
    const stored = await kvGet(`sourced:key:${raw}`);
    meta = stored ? JSON.parse(stored) : null;
  } catch {
    // KV down: fail open as anon rather than refusing service.
    return { tier: "anon", id: `ip:${clientIp(req)}` };
  }
  if (!meta || meta.disabled) return { error: "unknown or revoked key", status: 401 };
  return { tier: "key", id: `key:${chainIdOf(raw)}`, sk: raw, meta };
}

/**
 * Enforce the caller's per-minute budget. Sets X-RateLimit-* headers and,
 * when exceeded, answers 429 itself. Returns true when the request may
 * proceed. `bucket` separates budgets (e.g. "req" vs "append").
 */
export async function rateLimit(req, res, caller, bucket = "req", rpmOverride) {
  const rpm = rpmOverride ?? TIERS[caller.tier].rpm;
  const minute = Math.floor(Date.now() / 60_000);
  let count = 1;
  try {
    count = await kvIncrEx(`sourced:rl:${bucket}:${caller.id}:${minute}`, 120);
  } catch {
    return true; // fail open
  }
  res.setHeader("X-RateLimit-Limit", String(rpm));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, rpm - count)));
  if (count > rpm) {
    res.setHeader("Retry-After", String(60 - Math.floor((Date.now() % 60_000) / 1000)));
    res.status(429).json({
      error: `rate limit: ${rpm} requests/minute (${caller.tier} tier)`,
      tier: caller.tier,
      upgrade: caller.tier === "anon" ? "an API key raises limits and adds persistent memory — hello@tickwire.news" : undefined,
    });
    return false;
  }
  return true;
}

/** Standard headers every v1 response carries. */
export function stamp(res) {
  res.setHeader("X-Sourced-Api", API_VERSION);
  res.setHeader("X-Sourced-Engine", ENGINE);
}
