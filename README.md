# Sourced

[![ci](https://github.com/Ryan-hasi/sourced/actions/workflows/ci.yml/badge.svg)](https://github.com/Ryan-hasi/sourced/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40sourcedhq%2Fcore?label=%40sourcedhq%2Fcore)](https://www.npmjs.com/package/@sourcedhq/core)
[![✓ SOURCED](https://sourced.network/mark/sourced-mark.svg)](https://sourced.network)

> **Corroboration as a primitive.**
> Given a stream of claims from many origins, Sourced tells you how many
> **independent** sources corroborate each one, since when, and hands you the
> receipts. It says *"confirmed by sources"* — never *"the truth."*

Every feed, every aggregator, every "is this real?" moment re-solves the same
problem badly or not at all: a thousand items, each equally loud, no signal for
which ones the world actually agrees happened. The missing layer is the oldest
heuristic in journalism — *get a second source* — computed continuously over a
live stream, honestly. Sourced is that layer, as one small function.

```ts
import { assess, createMemoryStore } from "@sourcedhq/core";

const store = createMemoryStore(); // or your KV / SQLite / file

const verdicts = await assess(
  [
    { id: "a", title: "Central bank raises rates", origin: "reuters", publishedAt: "2026-01-01T12:00:00Z" },
    { id: "b", title: "Central bank raises rates", origin: "bbc",     publishedAt: "2026-01-01T12:04:00Z" },
  ],
  { store },
);

// verdicts[1] → {
//   corroboration: 2,                 // distinct INDEPENDENT origins
//   corroboratingSources: ["reuters"],// the receipts
//   firstSeenAt: "2026-01-01T12:…",   // when the system first saw the event
//   signal: "breaking",               // confirmed | breaking | developing | null
// }
```

No dependencies. Storage, clustering, clock and thresholds are injected — run
it against news, outage reports, OSINT feeds, sensor events or moderation
flags. Sourced only counts; how you group "same event" is pluggable.

## The honesty guarantees

These are invariants, not preferences — and they ship as an executable,
adversarial test suite (`@sourcedhq/conformance`), not as promises:

| # | Guarantee |
|---|---|
| **G1** | **Undercount, never overcount.** Matching is deliberately conservative (dual gate). A false *"confirmed"* is a reputation balloon that pops — Sourced always errs toward saying less. |
| **G2** | **Never "true," only "corroborated."** Truth is not computable from headlines; breadth of independent reporting is. |
| **G3** | **Independence is by origin, not by article.** Ten syndicated copies of one wire story count as **one**. |
| **G4** | **Every verdict carries its receipts** — who corroborated, since when. Falsifiable by design. |
| **G5** | **Single sources stay bare.** No badge, no signal. Silence protects credibility. |
| **G6** | **Signal rides the reliable clock.** Urgency comes from upstream publish time — a matching error can never invent "breaking". |
| **G7** | **Fail open, never break.** Dead storage, garbage input → claims pass through unlabeled. Degrading is safe; crashing is not. |

Run the yardstick against *any* engine claiming to count sources:

```ts
import { runConformance } from "@sourcedhq/conformance";
const report = await runConformance(myAssessImplementation);
```

## The transparency log

`@sourcedhq/log` chains every verdict batch into a tamper-evident hash chain
(Certificate-Transparency style). Anchor the chain head anywhere public and the
whole history becomes verifiable: rewriting any past verdict breaks every hash
after it. *"We have issued honest verdicts since day one"* stops being a
marketing line and becomes something you can check.

## Packages

| Package | What |
|---|---|
| `@sourcedhq/core` | The primitive: `assess(claims, { clusters, store, archive, now, config })` → verdicts. Zero deps. |
| `@sourcedhq/conformance` | G1–G7 as adversarial executable cases + runner. The yardstick. |
| `@sourcedhq/log` | Hash-chained, anchorable transparency log for verdict history. |

```bash
npm install        # workspace setup
npm test           # 20 adversarial + unit tests
```

## Beyond news

The unit is `(claim, origin, timestamp)` — not "a news article". Swap the
clustering and the storage, keep the counting and the guarantees:

```bash
npm run build && node examples/outage/run.mjs
# one flaky probe stays bare · repeat reports collapse ·
# 4 independent monitors → CONFIRMED, with receipts

npm run build && node examples/moderation/run.mjs
# one user flag → queue · AI confirms → DEVELOPING ·
# 2 human moderators agree → 4 flags = CONFIRMED, auto-action
```

News, outage detection, OSINT, sensor fusion, moderation queues — anywhere
independent reports describe discrete events.

## The Sourced surfaces

| Domain | Function |
|---|---|
| **sourced.ink** | The spec, in ink — guarantees, docs, the pitch. The public face. |
| **sourced.run** | Run it — hosted `assess` playground & API. |
| **sourced.network** | The network — live transparency-log head, anchor history, verdict stats. |

## Who runs on it

**[Tickwire](https://tickwire.news)** — the live news channel for the screen
you already leave on — is built on Sourced: every ✓ *N sources* badge in the
app is a Sourced verdict, receipts included.

## Status & license

Early, honest, moving. The spec is stable (the guarantees are the contract);
the API is frozen at v1. See [docs/API-GUIDE.md](docs/API-GUIDE.md) for
integration.

**License: MIT** for all code (see LICENSE). The **Sourced name and mark are
reserved** — forks welcome, under their own name (see TRADEMARK-POLICY.md).
"Sourced-conformant" is a claim you earn by passing `@sourcedhq/conformance`.

Contact: hello@tickwire.news.
