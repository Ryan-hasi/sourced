/**
 * GET /api/conformance — run the G1–G7 yardstick against the live engine,
 * on demand, in front of whoever asks. The honesty claim as an endpoint.
 */
import { assess } from "./_core.mjs";
import { CASES } from "./_conformance.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const results = [];
  for (const c of CASES) {
    const r = await c.run(assess);
    results.push({ id: c.id, guarantee: c.guarantee, title: c.title, pass: r.pass, detail: r.detail });
  }
  const failed = results.filter((r) => !r.pass).length;
  res.status(200).json({
    ranAt: new Date().toISOString(),
    engine: "@sourced/core",
    passed: results.length - failed,
    failed,
    results,
  });
}
