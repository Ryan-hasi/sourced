/**
 * POST /api/dashboard/proxy — Clerk-authenticated proxy to admin endpoints.
 *
 * Strict Auth Wall:
 * 1. Verifies Clerk JWT and active session status via Clerk API.
 * 2. Verifies primary email against admin whitelist (ryan.hasenfratz@gmail.com, hello@tickwire.news, SOURCED_ADMIN_EMAILS).
 * 3. ONLY authorized admin users are proxied to internal endpoints with SOURCED_ADMIN_SECRET.
 *
 * Body:
 *   { _endpoint: "keys" | "stats" | "chains", action?: string, ...params }
 */

import { verifyAndAuthorizeClerkUser } from "./session.mjs";

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

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = ["https://sourced.run", "https://www.sourced.run", "http://localhost:4181"];
  if (process.env.SOURCED_DASHBOARD_ORIGIN) allowed.push(process.env.SOURCED_DASHBOARD_ORIGIN);
  if (allowed.includes(origin) || !origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "https://sourced.run");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(req, res) {
  if (!res.status) res.status = (c) => { res.statusCode = c; return res; };
  if (!res.json) res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };

  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "missing Clerk session token" });

  // Enforce strict Server-Side Clerk verification & admin whitelist check
  const authResult = await verifyAndAuthorizeClerkUser(token);
  if (!authResult.authorized || authResult.error) {
    return res.status(authResult.status || 403).json({
      error: authResult.error || "Access denied. Account is not an authorized administrator.",
    });
  }

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }

  const endpoint = body._endpoint || "keys";
  delete body._endpoint;
  const adminSecret = process.env.SOURCED_ADMIN_SECRET || "sourced_admin_live_key_2026";
  const host = req.headers.host || "sourced.run";

  if (endpoint === "chains") {
    try {
      const proxyRes = await fetch(`https://${host}/api/v1/chains`);
      const data = await proxyRes.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(502).json({ error: `proxy error: ${err.message}` });
    }
  }

  if (endpoint === "stats") {
    if (!adminSecret) return res.status(503).json({ error: "admin secret not configured (SOURCED_ADMIN_SECRET)" });
    try {
      const proxyRes = await fetch(`https://${host}/api/v1/stats`, {
        headers: { "x-admin-secret": adminSecret },
      });
      const data = await proxyRes.json();
      return res.status(proxyRes.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: `proxy error: ${err.message}` });
    }
  }

  if (!adminSecret) return res.status(503).json({ error: "admin secret not configured (SOURCED_ADMIN_SECRET)" });
  try {
    const proxyRes = await fetch(`https://${host}/api/v1/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify(body),
    });
    const data = await proxyRes.json();
    return res.status(proxyRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: `proxy error: ${err.message}` });
  }
}
