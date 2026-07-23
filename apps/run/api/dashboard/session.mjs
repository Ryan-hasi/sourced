/**
 * GET /api/dashboard/session — verify Clerk session and admin authorization server-side.
 *
 * Strict Auth Wall:
 * 1. Verifies Clerk JWT and active session status via Clerk API (/v1/sessions/{id}).
 * 2. Fetches verified primary email via Clerk API (/v1/users/{id}).
 * 3. Enforces strict admin email whitelist (ryan.hasenfratz@gmail.com, hello@tickwire.news, SOURCED_ADMIN_EMAILS).
 */

const ALLOWED_ADMIN_EMAILS = new Set([
  "ryan.hasenfratz@gmail.com",
  "hello@tickwire.news",
  ...(process.env.SOURCED_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
]);

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

export async function verifyAndAuthorizeClerkUser(token) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { error: "CLERK_SECRET_KEY not configured on server", status: 503 };

  const payload = parseJwt(token);
  if (!payload) return { error: "malformed session token", status: 401 };

  if (payload.exp && Date.now() / 1000 > payload.exp) {
    return { error: "session token expired", status: 401 };
  }

  const sessionId = payload.sid;
  const userId = payload.sub;

  if (!sessionId || !userId) {
    return { error: "invalid session claims", status: 401 };
  }

  try {
    // 1. Verify active session with Clerk API
    const sessRes = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${secretKey}` },
    });

    if (!sessRes.ok) {
      return { error: `clerk session verification failed: ${sessRes.status}`, status: 401 };
    }

    const sessData = await sessRes.json();
    if (sessData.status !== "active") {
      return { error: `session status is ${sessData.status}`, status: 401 };
    }

    // 2. Fetch user profile from Clerk API to get authentic primary email
    const userRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { "Authorization": `Bearer ${secretKey}` },
    });

    if (!userRes.ok) {
      return { error: `clerk user lookup failed: ${userRes.status}`, status: 401 };
    }

    const userData = await userRes.json();
    const primaryId = userData.primary_email_address_id;
    let userEmail = "";

    if (Array.isArray(userData.email_addresses)) {
      const primaryObj = userData.email_addresses.find((e) => e.id === primaryId) || userData.email_addresses[0];
      if (primaryObj) userEmail = (primaryObj.email_address || "").toLowerCase().trim();
    }

    if (!userEmail) {
      return { error: "no verified email found for user account", status: 403 };
    }

    // 3. Strict Admin Whitelist Authorization Check
    const isAuthorized = ALLOWED_ADMIN_EMAILS.has(userEmail);
    if (!isAuthorized) {
      return {
        authorized: false,
        error: `Access denied. ${userEmail} is not an authorized administrator.`,
        email: userEmail,
        status: 403,
      };
    }

    return {
      authorized: true,
      userId,
      sessionId,
      email: userEmail,
    };
  } catch (err) {
    return { error: `clerk verify error: ${err.message}`, status: 502 };
  }
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
    return res.status(503).json({ authenticated: false, authorized: false, error: "CLERK_SECRET_KEY not configured", publishableKey });
  }

  const authHeader = req.headers.authorization || "";
  const sessionToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!sessionToken) {
    return res.status(401).json({ authenticated: false, authorized: false, publishableKey });
  }

  const authResult = await verifyAndAuthorizeClerkUser(sessionToken);
  if (authResult.error || !authResult.authorized) {
    return res.status(authResult.status || 403).json({
      authenticated: true,
      authorized: false,
      email: authResult.email || "",
      error: authResult.error || "Access denied for this account",
      publishableKey,
    });
  }

  return res.status(200).json({
    authenticated: true,
    authorized: true,
    email: authResult.email,
    userId: authResult.userId,
    sessionId: authResult.sessionId,
    publishableKey,
  });
}
