/**
 * POST /api/dashboard/proxy — Clerk-authenticated proxy to admin endpoints.
 *
 * The dashboard authenticates via Clerk (browser SDK). This endpoint verifies
 * the Clerk session server-side using CLERK_SECRET_KEY, then proxies to the
 * admin API with SOURCED_ADMIN_SECRET. The browser never sees the admin secret.
 *
 * Body:
 *   { _endpoint: "keys" | "stats" | "chains", action?: string, ...params }
 *
 * _endpoint routing:
 *   "keys"   → POST /api/v1/keys   (with x-admin-secret)
 *   "stats"  → GET  /api/v1/stats  (with x-admin-secret)
 *   "chains" → GET  /api/v1/chains (public, no admin secret needed)
 */

const CLERK_VERIFY_URL = "https://api.clerk.com/v1/tokens/verify";

async function verifyClerkToken(token) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { error: "CLERK_SECRET_KEY not configured", status: 503 };

  try {
    const res = await fetch(CLERK_VERIFY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      return { error: `clerk verification failed: ${res.status}`, status: 401 };
    }

    const data = await res.json();
    const isValid = data.status === "verified" || data.status === "active";
    if (!isValid) {
      return { error: `session ${data.status}`, status: 401 };
    }

    return { userId: data.user_id || data.claims?.sub };
  } catch (err) {
    return { error: `clerk verify error: ${err.message}`, status: 502 };
  }
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

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = ["https://sourced.run", "http://localhost:4181"];
  if (process.env.SOURCED_DASHBOARD_ORIGIN) allowed.push(process.env.SOURCED_DASHBOARD_ORIGIN);
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "missing Clerk session token" });

  const clerkResult = await verifyClerkToken(token);
  if (clerkResult.error) {
    return res.status(clerkResult.status || 401).json({ error: clerkResult.error });
  }

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }

  const endpoint = body._endpoint || "keys";
  delete body._endpoint;
  const host = req.headers.host || "sourced.run";
  const adminSecret = process.env.SOURCED_ADMIN_SECRET;

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
    if (!adminSecret) return res.status(503).json({ error: "admin not configured" });
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

  if (!adminSecret) return res.status(503).json({ error: "admin not configured" });
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
