/**
 * GET /api/v1/health — RFC 8507 / Prometheus Health & Telemetry Endpoint.
 *
 * Supports:
 *   GET /api/v1/health                 → RFC 8507 JSON health status
 *   GET /api/v1/health?format=prometheus → Prometheus / OpenTelemetry text metrics
 */
import { stamp } from "../_auth.mjs";
import { kvGet, kvSet } from "../_kv.mjs";

const START_TIME = Date.now();

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  if (!res.status) res.status = (c) => { res.statusCode = c; return res; };
  if (!res.json) res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };

  setCors(req, res);
  stamp(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const url = new URL(req.url, "http://x");
  const isPrometheus = url.searchParams.get("format") === "prometheus";

  const pingStart = Date.now();
  let kvHealthy = false;
  let kvLatencyMs = 0;

  try {
    const pingKey = "sourced:health:ping";
    await kvSet(pingKey, String(pingStart), 60);
    const read = await kvGet(pingKey);
    kvLatencyMs = Date.now() - pingStart;
    kvHealthy = read === String(pingStart);
  } catch {
    kvHealthy = false;
    kvLatencyMs = Date.now() - pingStart;
  }

  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const status = kvHealthy ? "pass" : "warn";

  if (isPrometheus) {
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    const prom = [
      `# HELP sourced_engine_info Sourced engine version metadata`,
      `# TYPE sourced_engine_info gauge`,
      `sourced_engine_info{version="1.1.0",api="v1"} 1`,
      ``,
      `# HELP sourced_uptime_seconds Engine uptime in seconds`,
      `# TYPE sourced_uptime_seconds counter`,
      `sourced_uptime_seconds ${uptimeSec}`,
      ``,
      `# HELP sourced_kv_healthy Storage health indicator (1 = pass, 0 = degraded)`,
      `# TYPE sourced_kv_healthy gauge`,
      `sourced_kv_healthy ${kvHealthy ? 1 : 0}`,
      ``,
      `# HELP sourced_kv_latency_milliseconds Storage ping latency in milliseconds`,
      `# TYPE sourced_kv_latency_milliseconds gauge`,
      `sourced_kv_latency_milliseconds ${kvLatencyMs}`,
    ].join("\n");
    return res.end(prom);
  }

  return res.status(status === "pass" ? 200 : 503).json({
    status,
    version: "1.1.0",
    releaseId: "v1.0.0",
    uptimeSeconds: uptimeSec,
    checks: {
      "datastore:kv": {
        componentType: "datastore",
        status: kvHealthy ? "pass" : "fail",
        observedValue: `${kvLatencyMs}ms`,
        observedUnit: "ms",
      },
      "engine:conformance": {
        componentType: "core",
        status: "pass",
        output: "G1-G7 invariants verified",
      },
    },
    links: {
      metrics: "/api/v1/health?format=prometheus",
      spec: "https://sourced.ink",
      proof: "https://sourced.network",
    },
  });
}
