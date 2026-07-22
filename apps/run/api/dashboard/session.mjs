/**
 * GET /api/dashboard/session — verify Clerk session server-side.
 *
 * Reads Clerk's __session cookie from the request, verifies it against
 * Clerk's backend API using CLERK_SECRET_KEY, and returns session info.
 * No frontend SDK needed.
 */

const CLERK_VERIFY_URL = "https://api.clerk.com/v1/sessions/verify";

export default async function handler(req, res) {
  const cors = {
    "Access-Control-Allow-Origin": "https://sourced.run",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405, cors);
    res.end("Method not allowed");
    return;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.writeHead(503, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "CLERK_SECRET_KEY not configured" }));
    return;
  }

  const sessionToken = req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("__session="))
    ?.split("=")[1];

  if (!sessionToken) {
    res.writeHead(401, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ authenticated: false }));
    return;
  }

  try {
    const verifyRes = await fetch(CLERK_VERIFY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_token: sessionToken }),
    });

    if (!verifyRes.ok) {
      res.writeHead(401, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify({ authenticated: false, error: "invalid session" }));
      return;
    }

    const data = await verifyRes.json();
    if (data.status !== "active") {
      res.writeHead(401, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify({ authenticated: false, status: data.status }));
      return;
    }

    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({
      authenticated: true,
      userId: data.user_id,
      sessionId: data.id,
      token: sessionToken,
    }));
  } catch (err) {
    res.writeHead(502, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `verification failed: ${err.message}` }));
  }
}
