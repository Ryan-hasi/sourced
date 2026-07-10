/**
 * Sourced beyond news — outage corroboration demo.
 *
 * Same primitive, different domain: a "claim" is a failure report, an
 * "origin" is a monitor/region, and the verdict answers: is this a real
 * outage or one flaky probe?
 *
 *   npm run build && node examples/outage/run.mjs
 */
import { assess, createMemoryStore } from "../../packages/core/dist/index.js";

const T0 = Date.UTC(2026, 6, 10, 21, 0, 0);
const at = (min) => new Date(T0 + min * 60_000).toISOString();
const store = createMemoryStore();

// Outage tuning: faster world than news — shorter breaking window,
// 3 independent monitors already count as confirmed.
const config = { confirmedAt: 3, breakingWindowMs: 10 * 60_000 };

const report = (id, title, origin, min) => ({ id, title, origin, publishedAt: at(min) });

// ── T+0 min: one probe complains (could be the probe's own network) ──────
const wave1 = [report("r1", "API gateway timeouts eu-west cluster", "monitor-frankfurt", 0)];

// ── T+2 min: independent monitors + user reports agree ───────────────────
const wave2 = [
  report("r2", "API gateway timeouts eu-west cluster", "monitor-paris", 2),
  report("r3", "API gateway timeouts eu-west cluster", "statuspage-bot", 2),
  report("r4", "API gateway timeouts eu-west cluster", "user-reports", 2),
  // noise: a different, unrelated single report
  report("r5", "checkout latency spike us-east canary", "monitor-virginia", 2),
  // syndication check: the same monitor repeating itself must not inflate
  report("r6", "API gateway timeouts eu-west cluster", "monitor-paris", 2),
];

const label = (v) =>
  v === null
    ? "—"
    : `${v.corroboration} source${v.corroboration === 1 ? "" : "s"}` +
      (v.signal ? ` · ${v.signal.toUpperCase()}` : "") +
      (v.corroboratingSources.length ? `  [${v.corroboratingSources.join(", ")}]` : "");

console.log("T+0  — first report arrives:");
for (const [i, v] of (await assess(wave1, { store, now: T0, config })).entries()) {
  console.log(`  ${wave1[i].origin.padEnd(18)} ${wave1[i].title.padEnd(42)} → ${label(v)}`);
}

console.log("\nT+2  — independent monitors report:");
for (const [i, v] of (await assess(wave2, { store, now: T0 + 2 * 60_000, config })).entries()) {
  console.log(`  ${wave2[i].origin.padEnd(18)} ${wave2[i].title.padEnd(42)} → ${label(v)}`);
}

console.log(
  "\nSame counting, same guarantees as news: one probe stays bare (G5),",
  "\nrepeat reports collapse (G3), 4 independent monitors → CONFIRMED — with receipts (G4).",
);
