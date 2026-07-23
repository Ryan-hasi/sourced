/**
 * GET /api/dashboard/session — verify Clerk session server-side.
 *
 * Reads Clerk's Authorization header or __session cookie from the request,
 * verifies it against Clerk's backend API using CLERK_SECRET_KEY, and returns session info.
 */

const CLERK_VERIFY_URL = "https://api.clerk.com/v1/tokens/verify";

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
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("__session="))
    ?.split("=")[1];

  const sessionToken = bearerToken || cookieToken;

  if (!sessionToken) {
    return res.status(401).json({ authenticated: false, publishableKey });
  }

  try {
    const verifyRes = await fetch(CLERK_VERIFY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: sessionToken }),
    });

    if (!verifyRes.ok) {
      return res.status(401).json({ authenticated: false, error: "invalid session", publishableKey });
    }

    const data = await verifyRes.json();
    const isValid = data.status === "verified" || data.status === "active";

    if (!isValid) {
      return res.status(401).json({ authenticated: false, status: data.status, publishableKey });
    }

    return res.status(200).json({
      authenticated: true,
      userId: data.user_id || data.claims?.sub,
      sessionId: data.session_id || data.claims?.sid,
      token: sessionToken,
      publishableKey,
    });
  } catch (err) {
    return res.status(502).json({ error: `verification failed: ${err.message}`, publishableKey });
  }
}
