# Launch post — Show HN / Reddit

Reviewed against the shipped state on 2026-09-13. Every claim below was
re-checked that day (see "Verified" at the bottom). Two versions: the HN one
is plain text because HN renders no Markdown; the Reddit one keeps it.

## Title

Hard limit on HN is 80 characters. Recommended:

    Show HN: Sourced – count independent sources for a claim, never "true"   (70)

It carries the honest frame in the title itself, which is the thing that
distinguishes this from every "fact-check" tool. Alternatives, all ≤ 80:

    Show HN: Sourced – "how many independent sources?" as a zero-dep library + MCP   (78)
    Show HN: Sourced – how many independent sources confirm this claim? (zero deps)  (79)

The earlier drafts "An honest trust layer …" (82) and "every claim in your
feed says …" (88) are over the limit and were dropped.

## Show HN body — paste as-is

HN rules: paragraphs need a blank line between them or they merge; only
*italics* render; code must be indented two spaces after a blank line; bare
URLs auto-link; no bold, no headers, no bullets, no backticks.

```text
Every feed and every LLM answer is missing the same layer: nothing tells you how broadly a claim is corroborated by *independent* sources. Syndicated copies, repeat reports and same-outlet churn inflate most counters; AI grounding tools collapse to a true/false score. The oldest heuristic in journalism – "get a second source" – has no software equivalent.

Sourced is a small primitive that does one thing: given claims (title, origin, timestamp), it returns per claim how many *distinct independent origins* corroborate it, since when, and the receipts. It never says "true" – truth isn't computable from headlines; breadth of independent reporting is.

The honesty is executable, not marketing. Seven guarantees ship as an adversarial conformance suite you can run against any engine that claims to count sources: undercount, never overcount (dual-gate matching); syndication collapses to one origin; single sources stay unlabeled; urgency can't be faked; fail open. A hash-chained transparency log makes verdict history tamper-evident – the production chain is publicly verifiable at https://sourced.network, and every npm tarball carries a Sigstore provenance attestation (npm audit signatures).

Try it:

  npm install @sourcedhq/core

  import { assess, createMemoryStore } from "@sourcedhq/core";
  const store = createMemoryStore();
  const verdicts = await assess(
    [{ id: "1", title: "Fed raises rates", origin: "reuters",   publishedAt: new Date().toISOString() },
     { id: "2", title: "Fed raises rates", origin: "bloomberg", publishedAt: new Date().toISOString() }],
    { store }
  );
  // verdicts[1] → { corroboration: 2, corroboratingSources: ["reuters"], signal: "breaking" }

Zero dependencies; storage, clustering and clock are injected, so the same unit (claim, origin, timestamp) works for outage detection, OSINT, sensor fusion and moderation queues. For agents, "claude mcp add sourced -- npx -y @sourcedhq/mcp" exposes assess, verify_chain and run_conformance as MCP tools.

Spec: https://sourced.ink – Playground and free API: https://sourced.run – Code (MIT): https://github.com/Ryan-hasi/sourced

It runs in production inside Tickwire (https://tickwire.news) – every "✓ N sources" badge there is a Sourced verdict.

Happy to answer anything about the guarantees, the adversarial cases, or where this breaks.
```

## Reddit body (Markdown)

Every feed and LLM answer has the same missing layer: nothing tells you how
broadly a claim is corroborated by **independent** sources. Syndicated copies,
repeat reports and same-outlet churn inflate most counters. AI grounding tools
collapse to true/false scores. The journalistic heuristic — "get a second
source" — has no software equivalent.

Sourced is a small primitive that does one thing honestly: given claims
(title, origin, timestamp), it returns per claim how many DISTINCT
independent origins corroborate it, since when, and the receipts. It never
says "true", because truth isn't computable from headlines; breadth of
independent reporting is.

**The honesty is executable, not marketing:**
- G1 undercount-never-overcount (dual-gate matching), G3 syndication collapses
  to one origin, G5 single sources stay unlabeled, G6 urgency can't be faked,
  G7 fail-open — shipped as an adversarial conformance suite that runs live
  against the production engine: https://sourced.network
- Hash-chained transparency log makes verdict history tamper-evident;
  production chain publicly verifiable on that same page.
- Every npm tarball carries a Sigstore provenance attestation
  (`npm audit signatures` → "6 packages have verified attestations").

**Try it in 30 seconds:**
```bash
npm install @sourcedhq/core
```
```ts
import { assess, createMemoryStore } from "@sourcedhq/core";
const store = createMemoryStore();
const verdicts = await assess(
  [{ id: "1", title: "Fed raises rates", origin: "reuters", publishedAt: new Date().toISOString() },
   { id: "2", title: "Fed raises rates", origin: "bloomberg", publishedAt: new Date().toISOString() }],
  { store }
);
// verdicts[1] → { corroboration: 2, corroboratingSources: ["reuters"], signal: "breaking" }
```

**Surfaces:**
- Spec + docs: https://sourced.ink
- Playground + free API (no key needed, rate-limited): https://sourced.run
- Transparency log + live conformance: https://sourced.network
- Code (MIT): https://github.com/Ryan-hasi/sourced

**For AI agents:** `claude mcp add sourced -- npx -y @sourcedhq/mcp` — tools
`assess`, `verify_chain`, `run_conformance`.

Runs in production inside [Tickwire](https://tickwire.news) — every "✓ N sources"
badge is a Sourced verdict. Also works for outage detection, OSINT, sensor
fusion, moderation queues — anywhere independent reports describe discrete events.

Happy to answer anything about the guarantees, adversarial cases, or where this
breaks.

## Copy variants for different subreddits
- **r/programming**: Lead with the primitive + guarantees. The code snippet.
- **r/selfhosted**: Zero-dependency, self-hostable, bring-your-own-storage. The outage demo.
- **r/LocalLLaMA / r/ClaudeAI**: "Your LLM can now count independent sources." Lead with the MCP server.
  Do **not** lead with `assess_agent_consensus` until its description is fixed
  (see below) — as published it promises "zero-hallucination confidence", which
  is exactly the claim G2 forbids.

## Rules
- One launch at a time: post after Tickwire's own launch, not alongside it.
- Never claim "detects truth/fake news". The honest frame IS the pitch — it is
  in the title on purpose.
- No spamming — one HN post, then targeted subreddits, quality over quantity.
- Answer every comment in the first two hours; HN ranking is decided there.

## Verified 2026-09-13 (against the packages on npm, not the repo)
- `npm install @sourcedhq/core` → 1.1.1, tarball includes `dist/independence.js`.
- The snippet above, run in an empty directory against the published package,
  prints exactly `{"corroboration":2,"corroboratingSources":["reuters"],
  "firstSeenAt":"…","signal":"breaking"}`.
- `npx -y @sourcedhq/mcp` answers the MCP `initialize` handshake and lists
  `assess, verify_chain, run_conformance, assess_agent_consensus`.
- `npm audit signatures` on all six packages: "6 packages have verified attestations".
- `POST https://www.sourced.run/api/assess` without a key → 200 with verdicts.
- https://sourced.ink, https://sourced.run, https://sourced.network, https://tickwire.news → 200.
- Conformance suite: 14 adversarial cases; full test run 94/94.

### Open before posting
- `@sourcedhq/mcp`: tool description of `assess_agent_consensus` says
  "hallucination elimination" / "zero-hallucination confidence" — contradicts G2
  and will be the first thing an HN commenter quotes. Reword to the corroboration
  frame and ship 1.0.2 (also reports `serverInfo.version` as 1.0.0 — hardcoded).
  That release doubles as the first end-to-end test of OIDC trusted publishing.
