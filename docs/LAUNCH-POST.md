# Launch post drafts (Show HN / Reddit) — publish when Ryan is back

## Show HN title options
1. Show HN: Sourced — "how many independent sources?" as a zero-dep primitive + MCP
2. Show HN: An honest trust layer — corroboration counting with executable guarantees
3. Show HN: Sourced — every claim in your feed says how many independent origins confirm it

## Body (draft)

Every feed and LLM answer has the same missing layer: nothing tells you how
broadly a claim is corroborated by INDEPENDENT sources. Syndicated copies,
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
  G7 fail-open — shipped as an adversarial conformance suite: https://sourced.network
- Hash-chained transparency log makes verdict history tamper-evident;
  production chain publicly verifiable on that same page.

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
// verdicts[1] → { corroboration: 2, signal: "breaking", corroboratingSources: ["reuters"] }
```

**Surfaces:**
- Spec + docs: https://sourced.ink
- Playground + free API: https://sourced.run
- Transparency log: https://sourced.network
- Code (MIT): https://github.com/Ryan-hasi/sourced

**For AI agents:** `claude mcp add sourced -- npx -y @sourcedhq/mcp`

Runs in production inside [Tickwire](https://tickwire.news) — every "✓ N sources"
badge is a Sourced verdict. Also works for outage detection, OSINT, sensor
fusion, moderation queues — anywhere independent reports describe discrete events.

Happy to answer anything about the guarantees, adversarial cases, or where this
breaks.

## Copy variants for different subreddits
- **r/programming**: Lead with the primitive + guarantees. The code snippet.
- **r/selfhosted**: Zero-dependency, self-hostable, bring-your-own-storage. The outage demo.
- **r/LocalLLaMA / r/ClaudeAI**: "Your LLM can now count independent sources." Lead with MCP server + claim verification.

## Rules
- Post AFTER Ryan is back and AFTER Tickwire launch — one launch at a time.
- Never claim "detects truth/fake news". The honest frame IS the pitch.
- No spamming — one post, targeted audience, quality over quantity.
