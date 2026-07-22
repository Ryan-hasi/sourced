/**
 * POST /api/v1/keys — key administration. Ryan-only, gated by the
 * SOURCED_ADMIN_SECRET env var (header: x-admin-secret). Keys are handed
 * out manually for now — no signup flow before launch, by design.
 *
 *   { action: "create",  name }         → { key: "sk_src_…" }   (shown exactly once)
 *   { action: "revoke",  key }          → { revoked: true }
 *   { action: "disable", key }          → { disabled: true }    (soft, reversible)
 *   { action: "enable",  key }          → { enabled: true }     (re-enable disabled key)
 *   { action: "list" }                  → [{ key, name, tier, status, createdAt, chainId }]
 *   { action: "audit" }                 → [{ ts, action, key, detail }]
 *
 * Security:
 *   - Rate-limited to 10 req/min (admin budget)
 *   - timingSafeEqual for secret comparison
 *   - All mutations logged to audit trail (KV)
 *   - CORS open for dashboard origin only
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { chainIdOf, stamp, clientIp } from "../_auth.mjs";
import { kvGet, kvSet, kvDel, kvSAdd, kvSRem, kvSMembers, kvIncrEx } from "../_kv.mjs";

const ADMIN_RPM = 10;
const AUDIT_LOG_KEY = "sourced:admin:audit";
const AUDIT_MAX_ENTRIES = 200;

function authorized(req) {
  const secret = process.env.SOURCED_ADMIN_SECRET || "";
  const given = String(req.headers["x-admin-secret"] || "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function adminRateLimit(req, res) {
  const ip = clientIp(req);
  const minute = Math.floor(Date.now() / 60_000);
  let count = 1;
  try {
    count = await kvIncrEx(`sourced:rl:admin:${ip}:${minute}`, 120);
  } catch {
    return true;
  }
  res.setHeader("X-RateLimit-Limit", String(ADMIN_RPM));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, ADMIN_RPM - count)));
  if (count > ADMIN_RPM) {
    res.setHeader("Retry-After", String(60 - Math.floor((Date.now() % 60_000) / 1000)));
    res.status(429).json({ error: `admin rate limit: ${ADMIN_RPM} requests/minute` });
    return false;
  }
  return true;
}

async function audit(action, key, detail, ip) {
  try {
    const existing = JSON.parse((await kvGet(AUDIT_LOG_KEY)) || "[]");
    const entry = { ts: new Date().toISOString(), action, key: key ? key.slice(0, 14) + "…" : null, detail, ip };
    existing.push(entry);
    const trimmed = existing.slice(-AUDIT_MAX_ENTRIES);
    await kvSet(AUDIT_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    /* audit is best-effort — never blocks the action */
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = [
    "https://sourced.run",
    "http://localhost:4181",
  ];
  if (process.env.SOURCED_DASHBOARD_ORIGIN) {
    allowed.push(process.env.SOURCED_DASHBOARD_ORIGIN);
  }
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
}

async function resolveKey(input) {
  const raw = String(input || "").replace(/…$/, "");
  if (raw.startsWith("sk_src_") && raw.length > 14) return raw;
  const keys = await kvSMembers("sourced:keys:index");
  for (const sk of keys) {
    if (sk.slice(0, 14) === raw) return sk;
  }
  return null;
}

function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 10_000) reject(new Error("too large")); });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { reject(new Error("invalid JSON")); } });
  });
}

export default async function handler(req, res) {
  stamp(res);
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST { action, … } with x-admin-secret" });
  if (!process.env.SOURCED_ADMIN_SECRET) return res.status(503).json({ error: "admin disabled (SOURCED_ADMIN_SECRET not set)" });
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  if (!(await adminRateLimit(req, res))) return;

  const ip = clientIp(req);
  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }

  if (body.action === "create") {
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    const sk = "sk_src_" + randomBytes(24).toString("base64url");
    const meta = { name, tier: "key", createdAt: new Date().toISOString(), disabled: false };
    await kvSet(`sourced:key:${sk}`, JSON.stringify(meta));
    await kvSAdd("sourced:keys:index", sk);
    await audit("create", sk, `name=${name}`, ip);
    return res.status(200).json({ key: sk, chainId: chainIdOf(sk), ...meta, note: "shown once — store it now" });
  }

  if (body.action === "revoke") {
    const sk = await resolveKey(body.key);
    if (!sk) return res.status(404).json({ error: "key not found" });
    const meta = JSON.parse((await kvGet(`sourced:key:${sk}`)) || "null");
    await kvDel(`sourced:key:${sk}`);
    await kvSRem("sourced:keys:index", sk);
    await audit("revoke", sk, `name=${meta?.name ?? "?"}`, ip);
    return res.status(200).json({ revoked: true });
  }

  if (body.action === "disable") {
    const sk = await resolveKey(body.key);
    if (!sk) return res.status(404).json({ error: "key not found" });
    const stored = await kvGet(`sourced:key:${sk}`);
    if (!stored) return res.status(404).json({ error: "key not found" });
    const meta = JSON.parse(stored);
    meta.disabled = true;
    meta.disabledAt = new Date().toISOString();
    await kvSet(`sourced:key:${sk}`, JSON.stringify(meta));
    await audit("disable", sk, `name=${meta.name}`, ip);
    return res.status(200).json({ disabled: true, name: meta.name });
  }

  if (body.action === "enable") {
    const sk = await resolveKey(body.key);
    if (!sk) return res.status(404).json({ error: "key not found" });
    const stored = await kvGet(`sourced:key:${sk}`);
    if (!stored) return res.status(404).json({ error: "key not found" });
    const meta = JSON.parse(stored);
    meta.disabled = false;
    delete meta.disabledAt;
    await kvSet(`sourced:key:${sk}`, JSON.stringify(meta));
    await audit("enable", sk, `name=${meta.name}`, ip);
    return res.status(200).json({ enabled: true, name: meta.name });
  }

  if (body.action === "list") {
    const keys = await kvSMembers("sourced:keys:index");
    const out = [];
    for (const sk of keys) {
      try {
        const meta = JSON.parse((await kvGet(`sourced:key:${sk}`)) ?? "null");
        if (meta) out.push({
          key: sk.slice(0, 14) + "…",
          name: meta.name,
          tier: meta.tier,
          status: meta.disabled ? "disabled" : "active",
          createdAt: meta.createdAt,
          disabledAt: meta.disabledAt || null,
          chainId: chainIdOf(sk),
        });
      } catch { /* skip */ }
    }
    return res.status(200).json({ keys: out });
  }

  if (body.action === "audit") {
    const log = JSON.parse((await kvGet(AUDIT_LOG_KEY)) || "[]");
    const limit = Math.min(Number(body.limit) || 50, AUDIT_MAX_ENTRIES);
    return res.status(200).json({ entries: log.slice(-limit) });
  }

  return res.status(400).json({ error: "action must be create | revoke | disable | enable | list | audit" });
}
