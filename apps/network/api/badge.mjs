import { runConformance, badge, score } from "./_conformance.mjs";

export default async function handler(req, res) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
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

  const url = new URL(req.url, `http://${req.headers.host}`);
  const format = url.searchParams.get("format") || "svg";

  const result = await runConformance();
  const s = score(result);

  if (format === "svg") {
    res.writeHead(200, {
      ...cors,
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    });
    res.end(badge(result));
    return;
  }

  res.writeHead(200, {
    ...cors,
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
  });
  res.end(JSON.stringify({
    ranAt: new Date().toISOString(),
    engine: "@sourcedhq/core",
    ...s,
    results: result.results,
  }));
}
