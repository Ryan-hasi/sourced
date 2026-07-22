# Sourced

> **Corroboration as a primitive.**
> Given a stream of claims from many origins, Sourced tells you how many
> **independent** sources corroborate each one, since when, and hands you the
> receipts. It says *"confirmed by sources"* — never *"the truth."*

Sourced is Ryan's *Stempel*: the small, single-purpose, generation-lasting
building block underneath Tickwire — the way `zip` is the thing underneath a
hundred products, or VLC is the thing underneath "just play the file." The
money comes from Tickwire. Sourced is the part that is **his**, that outlives
the app, that other people could one day build on.

This file is the canonical specification. It is implementation-independent: the
reference implementation lives in Tickwire (`src/lib/story-graph.ts`), but the
primitive defined here could be re-implemented in any language against any claim
stream. Keep this document at reproduction-bar — detailed enough that a fresh
mind could rebuild Sourced from it alone.

---

## Implementation Status (2026-07-22)

The extraction described in §9 and §12 is **complete**. Sourced now lives as a
standalone monorepo at `github.com/Ryan-hasi/sourced` with six npm packages:

| Package | Status | What |
|---|---|---|
| `@sourcedhq/core` v1.1.0 | ✅ Extracted | The primitive: `assess()`, types, tokenize, independence map |
| `@sourcedhq/log` v1.0.0 | ✅ Extracted | Hash-chain transparency log |
| `@sourcedhq/archive` v1.0.0 | ✅ Built | Persistent event history (memory/file/KV backends) |
| `@sourcedhq/anchor` v1.0.0 | ✅ Built | OpenTimestamps calendar anchoring |
| `@sourcedhq/conformance` v1.1.0 | ✅ Extracted | G1–G7 adversarial suite + SVG badge |
| `@sourcedhq/mcp` v1.0.0 | ✅ Built | MCP server for AI agents |

Three public sites: **sourced.ink** (spec), **sourced.run** (API + playground +
dashboard), **sourced.network** (proof + conformance + chain verifier).

The `assess()` signature is exactly as §12 predicted:
`assess(claims, { clusters, store, archive, now, config, independenceMap })`.

---

## 1. The one sentence

**Sourced turns a flood of independent reports into a per-claim verdict:
_how many distinct sources corroborate this, since when, and who?_**

That's it. It is not a fact-checker, not a truth oracle, not sentiment, not a
recommender. It answers exactly one question — *how broadly is this
corroborated?* — and answers it honestly.

## 2. Why it exists

Every news app, every feed, every "is this real?" moment re-solves the same
problem badly or not at all. Aggregators show a **flat feed**: a thousand items,
each equally loud, no signal for which ones the world actually agrees happened.
The reader is left to eyeball logos and guess.

The missing layer is judgment about **breadth of confirmation** — the single
oldest heuristic in journalism (*"get a second source"*) — computed
continuously over a live stream. Nobody ships it as a clean primitive. Sourced
is that primitive.

The honest framing matters and is load-bearing: Sourced never claims a thing is
*true*. Truth is not a property you can compute from headlines. **Corroboration
is.** "Six independent outlets report this, first seen 17:04" is a fact about
the world's reporting that the reader can act on and verify — not a verdict
handed down. This is the difference between a trust layer that earns credibility
and one that inflates it until it pops.

## 3. The primitive

**In:** a set of claims. **Out:** the same claims, each annotated with a verdict.

```
Claim {
  id:        string      // stable identity of this report
  title:     string      // the claim, in words
  origin:    string      // the source/outlet making it (the unit of independence)
  timestamp: string      // when this report was published (ISO 8601)
}

// Optional: pre-grouped claims that describe the same event, keyed by claim id.
// If omitted, each claim is treated as its own event (single-source).
Clusters = Map<claimId, origin[]>

Verdict {
  corroboration:        number    // count of DISTINCT independent origins
  corroboratingSources: string[]  // the receipts: who else reported it (≤6)
  firstSeenAt:          string    // when the system FIRST saw this event (ISO)
  signal:               "confirmed" | "breaking" | "developing" | null
}
```

The clustering step (deciding "these two reports are the same event") is
**pluggable** — regex, an LLM, embeddings, or an upstream editor. Sourced's
guarantees are about the *counting*, and are independent of how the grouping is
produced. Tickwire's reference implementation uses an AI clustering pass; a
sensor network might use exact-match on an event id. Same primitive.

## 4. The algorithm

Sourced maintains a persistent **event store** and folds each new batch of
claims into it. The store — the accumulated timeline of what happened and when
the system first saw it — is the part that cannot be copied out of a feed,
because its value is the history itself.

1. **Identity.** A claim's title is reduced to meaning-bearing tokens:
   lowercased, punctuation stripped, stopwords (EN + DE) removed, tokens `< 3`
   chars dropped. The deterministic event **key** is the sorted set of the top
   8 tokens.

2. **Matching.** A new claim joins an existing event if the key matches exactly,
   otherwise by a **dual gate**: Jaccard token similarity `≥ 0.60` **and** at
   least **3 shared meaning-bearing tokens**. Both must hold. (See §5, G1 — this
   dual gate is the anti-overcount safeguard, not an optimization.)

3. **Corroboration.** Once an event is identified, its origin set is the union
   of every distinct origin seen for it — across this batch *and* all history.
   `corroboration = |distinct origins|`. The receipts are the other origins
   (excluding the reader's current one), capped at 6 for display.

4. **Signal.** Derived from corroboration and the report's own publish age:
   - `confirmed`  — `corroboration ≥ 4`
   - `breaking`   — `corroboration ≥ 2` and published `< 30 min` ago
   - `developing` — `corroboration ≥ 2`
   - `null`       — a single origin stays **unlabeled** (see G5)

   The age test uses the claim's **published timestamp** (a reliable upstream
   value), never the system's own `firstSeenAt` — so a matching error can never
   falsely shout "breaking" (see G6).

5. **Decay & bound.** Events unseen for `36 h` are forgotten; the store is
   capped at the `400` most-recently-seen events. Corroboration reflects a
   living window, not an ever-growing tally.

## 5. The honesty guarantees

These are the *proof-and-secured* part — the promises that make Sourced a trust
primitive instead of a hype machine. They are invariants, not preferences.

- **G1 — Undercount, never overcount.** Matching is deliberately conservative
  (dual gate: high similarity *and* ≥3 shared tokens). Short headlines can share
  two words by chance; Sourced would rather miss a real corroboration than
  manufacture a false one. A false *"confirmed"* is a reputation balloon that
  pops. We always err toward saying *less*.

- **G2 — Never "true," only "corroborated."** The output vocabulary is
  `N sources`, `confirmed`, `developing` — statements about *reporting*, with
  receipts. Sourced never asserts a claim is factually true. Confirmation is not
  truth, and Sourced does not blur the two.

- **G3 — Independence is by origin, not by article.** The unit counted is the
  distinct **origin**, not the distinct article. Ten copies of one wire story
  syndicated across ten pages count as **one**. Corroboration means *independent*
  sources.

- **G4 — Every verdict carries its receipts.** A corroboration count is never
  shown without *who* corroborated and *since when*. The reader can always check
  the claim against the named sources. Falsifiable by design.

- **G5 — Single sources stay bare.** A one-origin claim gets **no** badge and
  **no** signal. Sourced only speaks when it has something corroborated to say;
  silence protects credibility.

- **G6 — Signal rides the reliable clock.** Velocity labels are computed from the
  upstream publish time, not from Sourced's own first-seen guess, so an identity
  mistake can shift a count but can never invent urgency.

- **G7 — Fail open, never break.** Every step is best-effort. Missing store,
  storage error, empty clusters, malformed input → the claims pass through
  **unlabeled**. Sourced never throws into the stream it annotates. Degrading to
  "no verdict" is always safe; crashing is not.

## 6. What Sourced is deliberately NOT

- Not a **fact-checker** — it counts sources, it does not adjudicate claims.
- Not a **truth oracle** — see G2.
- Not **sentiment or bias** analysis — orthogonal concern.
- Not a **recommender** or ranker — it annotates, it does not reorder for
  engagement.
- Not **ML-bound** — the clustering is pluggable; the primitive runs with a
  regex or with embeddings. The guarantees hold either way.

Keeping the surface this small is what makes it a *building block* and not a
product. A block does one thing so well that a hundred products can lean on it.

## 7. Adversarial view

How would someone game a corroboration count, and why Sourced resists:

- **Astroturf many outlets.** To inflate a count you need genuinely *distinct
  origins*, not many articles — G3 collapses syndication and copies to one. The
  cost of faking corroboration is the cost of standing up many independent
  sources, which is the real-world cost of the thing being real.
- **Keyword-stuff a headline to hijack an event.** The dual gate (G1) blocks
  coincidental short-title matches; hijacking requires genuinely overlapping
  meaning tokens, i.e. actually being about the same event.
- **Rush a "breaking" label.** The signal rides the upstream clock (G6); a
  planted first-sighting cannot manufacture urgency.

The design bias throughout is **toward undercounting** — the only direction that
protects the reader's trust.

## 8. Reference implementation

- **Tickwire** — `src/lib/story-graph.ts`
  - `applyStoryGraph(items, clusters)` — annotates a batch with corroboration,
    first-seen, and signal; maintains the KV event store. Runs inside the feed
    rebuild (behind the cache), not per visitor.
  - `applyWhy(heroItems)` — a *separate* layer ("why it matters"), not part of
    the Sourced primitive; documented here only to mark the boundary. Sourced is
    the corroboration verdict; the "why" line is Tickwire product on top of it.
- Storage: Vercel KV (`events:v1`). Any durable key-value store works.
- Clustering source: `ai-curate.ts` (NVIDIA Llama pass).

The clean extracted interface, when the time comes, is one call:

```
sourced.assess(claims, { clusters, store }) -> Verdict[]
```

## 9. Ownership & path to extraction

Sourced is **Ryan's**. The intent is not to get rich from it — the intent is
that it *exists*, that it is *his*, and that it is good enough to outlast the
thing it was born inside.

Sequencing (see [[tickwire-launch-strategy]] and [[Decisions]]):

1. **Now — embedded.** Sourced lives inside Tickwire as `story-graph.ts` and
   earns its keep in a real product. Do not extract yet; a building block with no
   users is a README, not a standard.
2. **After Tickwire has users** — extract into a standalone, dependency-free
   module (storage and clustering injected, not assumed), under the name
   **Sourced**, documented from this spec. License stance is Ryan's call at that
   point; the honest-primitive framing (§5) is the part worth being principled
   about.
3. **If it earns it** — a small open standard for "corroboration verdicts" that
   other feeds, dashboards, and sensor streams can emit and consume.

Do not let extraction distract from launch. The order is fixed: make Tickwire
work and get users, *then* lift the block out cleanly.

## 10. Why the name

**Sourced.** It says the function the way `zip` says the function — a claim that
is *Sourced* is one backed by named origins. It is one real word anyone can
pronounce, it is already Tickwire's own language (the "✓ N sources" badge), and
it keeps the honest frame in the name itself: *sourced*, never *proven*, never
*true*.

## 11. Beyond news — where the primitive generalizes

The unit Sourced operates on is not "a news article." It is `(claim, origin,
timestamp)` plus a way to group claims that describe the same event. Any domain
with **independent reports of discrete events** is a fit — swap the clustering
and the storage, keep the counting and the guarantees (§5) untouched. That
substitution is what turns "Tickwire's feed trick" into a primitive:

| Domain | A "claim" is… | An "origin" is… | The verdict answers |
|---|---|---|---|
| **News** (Tickwire) | a headline | an outlet | how broadly is this reported? |
| **Outage / incident** | a failure report | a monitor / user / region | is this a real outage or noise? |
| **OSINT / verification** | a field report | an account / feed | how many independent eyes confirm it? |
| **Content moderation** | a "this is bad" flag | a distinct reporter | is this genuinely mass-flagged, honestly counted? |
| **Sensor / event fusion** | a detection | a sensor | do multiple sensors agree an event occurred? |
| **Market / event feeds** | an event print | a data vendor | is this move corroborated across vendors? |

In every row the honest frame holds: Sourced reports *breadth of independent
corroboration with receipts*, never *truth*. The narrower a block's surface, the
wider its reach — this table is the reach.

## 12. Extraction seams (prep for the clean lift-out)

The reference implementation (`applyStoryGraph`) is already ~90% a pure
primitive. Extraction later is *parameterizing three couplings*, not a rewrite —
a weekend, not a project. The seams, so future-us knows exactly where to cut:

1. **Clustering — already external.** `applyStoryGraph(items, clusters)` takes
   `clusters` as an argument; it never calls the AI itself. This seam is *done*.
   The extracted core consumes a grouping; how you produce it (LLM, regex,
   embeddings, upstream editor) stays out of the block.
2. **Storage — the one real coupling.** Today it calls `kvGet/kvSet` on
   `events:v1` (Vercel KV) directly. Seam: a tiny injected interface —
   `Store { load(): EventStore; save(EventStore): void }` — passed in. Vercel KV,
   SQLite, a file, or memory all satisfy it. This is the only substantive lift.
3. **Clock — inject `now`.** `Date.now()` is read directly; pass it in so runs
   are deterministic and testable. Trivial.
4. **Config — an options object.** The thresholds are constants today
   (`MERGE_SIM 0.60`, `MIN_SHARED_TOKENS 3`, signal cutoffs 4/2, `EVENT_TTL 36h`,
   `MAX_EVENTS 400`). Surface them as options with these values as defaults; the
   defaults *are* the honest-by-design tuning (§5, G1) — changing them loosens or
   tightens corroboration, so they are part of the contract, not knobs to fiddle.

The extracted shape is one pure function with no framework, no `fetch`, no
Vercel: `assess(claims, { clusters, store, now, config }) -> Verdict[]`. Nothing
else moves. **Do not build this now** (see §9) — this section exists so that when
Tickwire has users, the lift-out is mechanical.

## 13. The two-brand flywheel & the power bar

**Decision (Ryan, 2026-07-10, logged in [[Decisions]]):** Tickwire and Sourced
market *each other*. Tickwire carries a big, visible **"Built on Sourced"**;
Sourced is presented as the engine that **"powers apps like Tickwire."** The
Intel-Inside pattern: the product proves the block, the block ennobles the
product — and Sourced stays spin-off-able as its own brand at any time.

**The condition (the power bar).** The flywheel only spins if the claim behind
it is real. The test is what we call **the Sourced answer**: when someone asks
Ryan *"why does your app have more than mine?"*, he must be able to answer with
conviction, with **verified** reasons, and with a clearly massive advantage:
*"Because I have Sourced."* For that sentence to be honest, all of this must be
true and checkable:

1. **A user can feel it in 10 seconds.** The ✓ *N sources* badge with receipts
   is visible, tappable, and correct on live news — not a whitepaper claim.
2. **The guarantees are proven, not promised.** §5 (G1–G7) ships as an
   executable test suite over the extracted core: adversarial fixtures for
   overcounting, syndication collapse, headline hijacking, fake urgency. "Our
   honesty is a passing test run" — that is a *verified* reason.
3. **The event store is the moat.** The accumulated first-seen timeline is data
   a copycat cannot scrape out of a feed — every day Tickwire runs, the answer
   to "why do you have more?" literally grows. This is the compounding part.
4. **It generalizes on demand.** §11's table must be demonstrable: at least one
   non-news demo (outage reports, OSINT, sensor fusion) running on the *same*
   extracted core proves "omnipotently applicable" instead of asserting it.
5. **It has a public face.** A one-pager at a Sourced domain/page (the spec,
   the guarantees, the demo) — because a loud "Built on Sourced" that links to
   nothing is an empty badge and burns both brands.

**Sequencing (finish-first still rules, see §9):** none of this is built before
Tickwire launches. What we anchor *now* is copy and spec: the "Built on
Sourced" line is reserved in the launch copy, this section defines the bar.
After launch, building Sourced into the massive tool — extraction (§12), test
suite, second-domain demo, public page — becomes the declared next arc. Tickwire
running in the wild is step 1 of that arc, not a detour from it.

**Marketing language (the honest frame carries over):** Sourced is sold as
*"the corroboration engine — receipts for every claim"*, never as a truth
machine. The pitch line pair:

- On Tickwire: **"Built on Sourced — every story verified against independent
  sources, with receipts."**
- On Sourced: **"The corroboration engine behind Tickwire — N independent
  sources, since when, and who. Never 'true', always 'sourced'."**

## 14. Protection — what makes Sourced un-clonable

Ryan's challenge (2026-07-10, correct): *"so far nothing we made couldn't be
rebuilt with a few prompts in an AI session."* True — the counting algorithm is
maybe 300 lines. **The code is not the moat and never will be.** zip and VLC
aren't protected by IP either; they won by ubiquity, trust, and being first to
own the definition. Sourced's protection is everything a prompt CANNOT
generate:

1. **The archive (time as moat).** The standalone Sourced keeps the **full
   event history forever** — every event, every origin, every first-seen
   timestamp, every corroboration curve. (Tickwire's embedded 36 h/400-event
   window is just one consumer's *view*; the engine's archive is unbounded.)
   A copycat cloned tomorrow starts with **zero history**. Every day of
   operation widens the gap automatically. This is the compounding asset.

2. **The transparency log (unfakeable track record).** Every verdict batch is
   appended to a **hash-chained log** (each entry contains the hash of the
   previous — Certificate-Transparency-style), and the chain head is
   periodically **anchored publicly** (e.g. committed to the public GitHub repo
   and/or OpenTimestamps — both free). Result: *"we have issued honest,
   undercounted verdicts since 2026 and you can cryptographically verify we
   never rewrote history."* A prompt can clone the code; it **cannot fake the
   years**. This is the literal, technical form of "verified reasons".

3. **Owning the definition (the conformance suite).** G1–G7 ship as a public,
   executable **conformance test suite**. Whoever publishes the test defines
   the category: any competitor's "we count sources too" gets measured against
   *our* bar — syndication collapse, overcount resistance, hijack resistance,
   fake-urgency resistance. Passing it means implementing Sourced; failing it
   means being the cheap one. Standards win by being the yardstick.

4. **The independence map (proprietary data).** G3 says independence is by
   origin — but *real* independence needs knowing that 50 local sites are one
   wire service, who owns whom, who syndicates whom. That curated
   **origin-independence dataset** is genuine accumulated work, improves every
   verdict, and cannot be prompted into existence reliably. It is the natural
   proprietary layer on top of the open core.

5. **Proof in production + brand.** Tickwire is the living deployment (§13
   flywheel). The name, the spec, the ✓-receipts language — first-mover on the
   *framing* ("corroborated, never true") is itself defensible; trademark the
   name when revenue justifies it (CH/EU filing is a few hundred francs, Ryan's
   call on timing).

**The business shape this implies — open core, proprietary history:**
- **Open (adoption):** the spec, the reference implementation, the conformance
  suite. Anyone can embed the primitive — that is how it becomes the standard.
- **Ours (moat):** the running archive, the transparency log with its anchored
  history, the independence map, and the hosted API over them. You can clone
  the engine; you cannot clone *having run it honestly since 2026 over
  everything the world reported*.

So the honest answer to "how do we protect it": **we don't protect the code —
we make the code the cheapest part.** The value lives in time (archive),
verifiability (log), authority (suite), and data (independence map). All four
start accumulating the day Sourced runs standalone — which is why building it
now, while Tickwire's launch waits, costs nothing strategically and starts the
clock on the moat.

---

*Canonical spec. Reference impl: Tickwire `src/lib/story-graph.ts`. Related:
[[News Feed]] · [[AI Dedup]] · [[Decisions]] · [[Architecture]].*
