/**
 * Sourced beyond news — OSINT / field verification demo.
 *
 * A claim = a field report ("convoy spotted on highway M1").
 * An origin = who reported it (account, feed, satellite image).
 * The verdict: how many independent eyes confirm this event?
 *
 * Key insight: a single viral account reporting something is NOT
 * corroboration. Sourced keeps it bare until independent confirmation
 * arrives — protecting against disinformation by design.
 *
 *   npm run build && node examples/osint/run.mjs
 */
import { assess, createMemoryStore, SEED_INDEPENDENCE_MAP } from "../../packages/core/dist/index.js";

const T0 = Date.UTC(2026, 6, 15, 8, 0, 0);
const at = (min) => new Date(T0 + min * 60_000).toISOString();
const store = createMemoryStore();

const report = (id, title, origin, min) => ({ id, title, origin, publishedAt: at(min) });

// OSINT tuning: 3 independent confirmations = confirmed, tight window.
const config = { confirmedAt: 3, breakingWindowMs: 15 * 60_000 };

// ── T+0: single Telegram channel reports something ──────────────────────
const wave1 = [
  report("o1", "military convoy on highway M1 heading north", "telegram-channel-A", 0),
];

// ── T+8: satellite imagery + second channel confirm ─────────────────────
const wave2 = [
  report("o2", "military convoy on highway M1 heading north", "satellite-imagery-feed", 8),
  report("o3", "military convoy on highway M1 heading north", "telegram-channel-B", 8),
  // Disinformation test: 5 accounts from same network report a fake event
  report("o4", "explosion at power plant sector 7", "bot-account-1", 8),
  report("o5", "explosion at power plant sector 7", "bot-account-2", 8),
  report("o6", "explosion at power plant sector 7", "bot-account-3", 8),
  report("o7", "explosion at power plant sector 7", "bot-account-4", 8),
  report("o8", "explosion at power plant sector 7", "bot-account-5", 8),
];

// ── T+20: journalist on the ground confirms convoy ─────────────────────
const wave3 = [
  report("o9", "military convoy on highway M1 heading north", "journalist-onsite", 20),
  // The fake explosion: only one credible source picks it up
  report("o10", "explosion at power plant sector 7", "local-news-outlet", 20),
];

// Custom independence map: bot accounts are one network
const osintMap = {
  groups: [
    ...SEED_INDEPENDENCE_MAP.groups,
    {
      canonical: "known-bot-network",
      relation: "editorial",
      note: "Known coordinated inauthentic behavior network",
      members: [
        "known-bot-network",
        "bot-account-1",
        "bot-account-2",
        "bot-account-3",
        "bot-account-4",
        "bot-account-5",
      ],
    },
  ],
};

const label = (v) =>
  v === null
    ? "—"
    : `${v.corroboration} source${v.corroboration === 1 ? "" : "s"}` +
      (v.signal ? ` · ${v.signal.toUpperCase()}` : "") +
      (v.corroboratingSources.length
        ? `  [${v.corroboratingSources.join(", ")}]`
        : "");

console.log("T+0  — single channel report:");
for (const [i, v] of (await assess(wave1, { store, now: T0, config, independenceMap: osintMap })).entries()) {
  console.log(`  ${wave1[i].origin.padEnd(24)} ${wave1[i].title.padEnd(42)} → ${label(v)}`);
}
console.log("  → bare, no signal. Single source is NOT corroboration.");

console.log("\nT+8  — satellite + second channel:");
for (const [i, v] of (await assess(wave2, { store, now: T0 + 8 * 60_000, config, independenceMap: osintMap })).entries()) {
  console.log(`  ${wave2[i].origin.padEnd(24)} ${wave2[i].title.padEnd(42)} → ${label(v)}`);
}
console.log("  → convoy = 3 independent (telegram-A + satellite + telegram-B) → CONFIRMED");
console.log("  → fake explosion = 1 independent (bot network collapses to 1 via independence map)");

console.log("\nT+20 — journalist on ground:");
for (const [i, v] of (await assess(wave3, { store, now: T0 + 20 * 60_000, config, independenceMap: osintMap })).entries()) {
  console.log(`  ${wave3[i].origin.padEnd(24)} ${wave3[i].title.padEnd(42)} → ${label(v)}`);
}
console.log("  → convoy now 4 sources with journalist receipt");
console.log("  → fake explosion = 2 independent (bot-network + local-news) = DEVELOPING, not confirmed");

console.log(
  "\nKey: the independence map collapsed 5 bot accounts to 1 unit.",
  "\nWithout it, the fake event would show 5 sources — with it, 1.",
  "\nThis is how Sourced resists astroturfing (§7).",
);
