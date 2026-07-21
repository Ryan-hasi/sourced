/**
 * Sourced beyond news — content moderation demo.
 *
 * A claim = a flag on a piece of content ("post 8723 violates policy X").
 * An origin = who flagged it (moderator, AI model, community report).
 * The verdict: is this a real violation (multiple independent flags agree)
 * or a single overzealous reporter?
 *
 *   npm run build && node examples/moderation/run.mjs
 */
import { assess, createMemoryStore } from "../../packages/core/dist/index.js";

const T0 = Date.UTC(2026, 6, 21, 14, 0, 0);
const at = (min) => new Date(T0 + min * 60_000).toISOString();
const store = createMemoryStore();

const report = (id, title, origin, min) => ({ id, title, origin, publishedAt: at(min) });

// ── T+0 min: single user report — could be anything ──────────────────────
const wave1 = [
  report("f1", "post_8723 — hate speech in comments", "user-report", 0),
];

// ── T+5 min: AI classifier also flags it — now 2 origins = developing ───
const wave2 = [
  report("f2", "post_8723 — hate speech in comments", "toxicity-classifier-v2", 5),
];

// ── T+12 min: 2 human moderators agree — 4 origins = CONFIRMED ──────────
const wave3 = [
  report("f3", "post_8723 — hate speech in comments", "moderator-anna", 12),
  report("f4", "post_8723 — hate speech in comments", "moderator-chen", 12),
  // noise: a different, unrelated single flag
  report("f5", "post_9101 — off-topic in #security", "user-report", 12),
];

const label = (v) =>
  v === null
    ? "—"
    : `${v.corroboration} flag${v.corroboration === 1 ? "" : "s"}` +
      (v.signal ? ` · ${v.signal.toUpperCase()}` : "") +
      (v.corroboratingSources.length
        ? `  [${v.corroboratingSources.join(", ")}]`
        : "");

console.log("T+0  — single user report:");
for (const [i, v] of (
  await assess(wave1, { store, now: T0 })
).entries()) {
  console.log(
    `  ${wave1[i].origin.padEnd(24)} ${wave1[i].title.padEnd(38)} → ${label(v)}`
  );
}
console.log("  → queue for review, no auto-action.");

console.log("\nT+5  — AI classifier confirms:");
for (const [i, v] of (
  await assess(wave2, { store, now: T0 + 5 * 60_000 })
).entries()) {
  console.log(
    `  ${wave2[i].origin.padEnd(24)} ${wave2[i].title.padEnd(38)} → ${label(v)}`
  );
}
console.log("  → DEVELOPING — escalate to human review.");

console.log("\nT+12 — two moderators agree:");
for (const [i, v] of (
  await assess(wave3, { store, now: T0 + 12 * 60_000 })
).entries()) {
  console.log(
    `  ${wave3[i].origin.padEnd(24)} ${wave3[i].title.padEnd(38)} → ${label(v)}`
  );
}
console.log("  → CONFIRMED — 4 independent flags (1 user + 1 AI + 2 humans). Auto-action.");
console.log("  → The off-topic post stays bare (G5) — single source, no label.");

console.log(
  "\nSame guarantees as news: syndication collapses, single flags stay bare,",
  "\nreceipts show exactly who flagged. Humans can audit — 8723 = real case.",
);
