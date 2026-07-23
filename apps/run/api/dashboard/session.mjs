/**
 * GET /api/dashboard/session — verify Clerk session server-side.
 *
 * Decodes Clerk JWT token to extract session ID (sid), then verifies the active
 * status of the session against Clerk's backend API (GET /v1/sessions/{session_id}).
 */

function parseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = ["https://sourced.run", "http://localhost:4181"];
  if (process.env.SOURCED_DASHBOARD_ORIGIN) allowed.push(process.env.SOURCED_DASHBOARD_ORIGIN);
  if (allowed.includes(origin) || !origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "https://sourced.run");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(req, res) {
  if (!res.status) res.status = (c) => { res.statusCode = c; return res; };
  if (!res.json) res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };

  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "";
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    return res.status(503).json({ error: "CLERK_SECRET_KEY not configured", publishableKey });
  }

  const authHeader = req.headers.authorization || "";
  const sessionToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!sessionToken) {
    return res.status(401).json({ authenticated: false, publishableKey });
  }

  const payload = parseJwt(sessionToken);
  if (!payload) {
    return res.status(401).json({ authenticated: false, error: "malformed session token", publishableKey });
  }

  if (payload.exp && Date.now() / 1000 > payload.exp) {
    return res.status(401).json({ authenticated: false, error: "session expired", publishableKey });
  }

  const sessionId = payload.sid;
  const userId = payload.sub;

  if (!sessionId) {
    return res.status(200).json({
      authenticated: true,
      userId: userId || "unknown",
      token: sessionToken,
      publishableKey,
    });
  }

  try {
    const verifyRes = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${secretKey}` },
    });

    if (!verifyRes.ok) {
      return res.status(401).json({ authenticated: false, error: "invalid session", publishableKey });
    }

    const data = await verifyRes.json();
    if (data.status !== "active") {
      return res.status(401).json({ authenticated: false, status: data.status, publishableKey });
    }

    return res.status(200).json({
      authenticated: true,
      userId: data.user_id || userId,
      sessionId: data.id || sessionId,
      token: sessionToken,
      publishableKey,
    });
  } catch (err) {
    return res.status(502).json({ error: `verification failed: ${err.message}`, publishableKey });
  }
}
