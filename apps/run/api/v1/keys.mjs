/**
 * POST /api/v1/keys — key administration. Ryan-only, gated by the
 * SOURCED_ADMIN_SECRET env var (header: x-admin-secret). Keys are handed
 * out manually for now — no signup flow before launch, by design.
 *
 *   { action: "create", name }  → { key: "sk_src_…" }   (shown exactly once)
 *   { action: "revoke", key }   → { revoked: true }
 *   { action: "list" }          → [{ key: masked, name, tier, createdAt, chainId }]
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { chainIdOf, stamp } from "../_auth.mjs";
import { kvGet, kvSet, kvDel, kvSAdd, kvSRem, kvSMembers } from "../_kv.mjs";

function authorized(req) {
  const secret = process.env.SOURCED_ADMIN_SECRET || "";
  const given = String(req.headers["x-admin-secret"] || "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
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
  if (req.method !== "POST") return res.status(405).json({ error: "POST { action, … } with x-admin-secret" });
  if (!process.env.SOURCED_ADMIN_SECRET) return res.status(503).json({ error: "admin disabled (SOURCED_ADMIN_SECRET not set)" });
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }

  if (body.action === "create") {
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    const sk = "sk_src_" + randomBytes(24).toString("base64url");
    const meta = { name, tier: "key", createdAt: new Date().toISOString() };
    await kvSet(`sourced:key:${sk}`, JSON.stringify(meta));
    await kvSAdd("sourced:keys:index", sk);
    return res.status(200).json({ key: sk, chainId: chainIdOf(sk), ...meta, note: "shown once — store it now" });
  }

  if (body.action === "revoke") {
    const sk = String(body.key || "");
    await kvDel(`sourced:key:${sk}`);
    await kvSRem("sourced:keys:index", sk);
    return res.status(200).json({ revoked: true });
  }

  if (body.action === "list") {
    const keys = await kvSMembers("sourced:keys:index");
    const out = [];
    for (const sk of keys) {
      try {
        const meta = JSON.parse((await kvGet(`sourced:key:${sk}`)) ?? "null");
        if (meta) out.push({ key: sk.slice(0, 14) + "…", name: meta.name, tier: meta.tier, createdAt: meta.createdAt, chainId: chainIdOf(sk) });
      } catch { /* skip */ }
    }
    return res.status(200).json({ keys: out });
  }

  return res.status(400).json({ error: "action must be create | revoke | list" });
}
