/**
 * GET /api/v1/stats — dashboard statistics (admin-only).
 *
 * Returns:
 *   - Key stats: total, active, disabled
 *   - Chain stats: total chains, total records
 *   - KV health: reachable, latency
 *   - Audit trail: recent admin actions
 *
 * Auth: SOURCED_ADMIN_SECRET (x-admin-secret header)
 */
import { timingSafeEqual } from "node:crypto";
import { stamp } from "../_auth.mjs";
import { kvGet, kvSMembers } from "../_kv.mjs";

const AUDIT_LOG_KEY = "sourced:admin:audit";

function authorized(req) {
  const secret = process.env.SOURCED_ADMIN_SECRET || "";
  const given = String(req.headers["x-admin-secret"] || "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
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
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");
}

export default async function handler(req, res) {
  setCors(req, res);
  stamp(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!process.env.SOURCED_ADMIN_SECRET) return res.status(503).json({ error: "admin disabled" });
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });

  const stats = {
    generatedAt: new Date().toISOString(),
    keys: { total: 0, active: 0, disabled: 0 },
    chains: { total: 0, totalRecords: 0 },
    kv: { healthy: false, latencyMs: null },
    audit: [],
  };

  const start = Date.now();

  try {
    const keyIds = await kvSMembers("sourced:keys:index");
    stats.keys.total = keyIds.length;

    for (const sk of keyIds) {
      try {
        const meta = JSON.parse((await kvGet(`sourced:key:${sk}`)) || "null");
        if (meta?.disabled) stats.keys.disabled++;
        else stats.keys.active++;
      } catch {
        stats.keys.disabled++;
      }
    }

    const chainIds = await kvSMembers("sourced:chains:index");
    stats.chains.total = chainIds.length;

    for (const cid of chainIds) {
      try {
        const meta = JSON.parse((await kvGet(`sourced:chain:${cid}:meta`)) || "null");
        if (meta?.seq != null) stats.chains.totalRecords += meta.seq + 1;
      } catch { /* skip */ }
    }

    stats.kv.healthy = true;
    stats.kv.latencyMs = Date.now() - start;

    const auditLog = JSON.parse((await kvGet(AUDIT_LOG_KEY)) || "[]");
    stats.audit = auditLog.slice(-10);

  } catch (err) {
    stats.kv.healthy = false;
    stats.kv.error = String(err.message || err);
  }

  res.status(200).json(stats);
}
