# Launch post drafts (Show HN / Reddit) — publish when Ryan is back

## Show HN title options
1. Show HN: Sourced – corroboration as a primitive (counts independent sources, never says "true")
2. Show HN: An honest trust layer: how many independent sources confirm this claim?
3. Show HN: Sourced – the "get a second source" heuristic as a zero-dep library + MCP server

## Body (draft)

Every feed and every LLM answer has the same missing layer: nothing tells you
how broadly a claim is corroborated by INDEPENDENT sources. Fact-checkers
adjudicate single claims; aggregators count articles (syndication inflates
them); AI grounding tools collapse to true/false scores.

Sourced is a small primitive that does one thing honestly: given claims
(title, origin, timestamp), it returns per claim how many DISTINCT independent
origins corroborate it, since when, and the receipts — and it never says
"true", because truth isn't computable from headlines; breadth of independent
reporting is.

The honesty is executable, not marketing:
- G1 undercount-never-overcount (dual-gate matching), G3 syndication collapses
  to one origin, G5 single sources stay unlabeled, G6 urgency can't be faked,
  G7 fail-open — all shipped as an adversarial conformance suite you can run
  against ANY engine claiming to count sources: https://sourced.network
- A hash-chained transparency log makes the verdict history tamper-evident;
  our production deployment's chain is publicly verifiable on that same page.

Try it without installing: https://sourced.run (playground + free API).
Spec: https://sourced.ink · Code (MIT): https://github.com/Ryan-hasi/sourced
For agents: `claude mcp add sourced -- npx -y @sourcedhq/mcp`

It runs in production inside Tickwire (tickwire.news), a calm live-news app —
every "✓ N sources" badge there is a Sourced verdict.

Happy to answer anything about the honesty guarantees, the adversarial cases,
or where this breaks.

## Reddit targets
r/programming (the primitive + guarantees angle), r/selfhosted (zero-dep,
self-hostable), r/LocalLLaMA + r/ClaudeAI (MCP grounding angle — lead with
the agent story, not the news story).

## Rules
- Post AFTER Ryan is back (support availability) and AFTER Tickwire launch
  decision — one launch at a time.
- Never claim "detects truth/fake news". The honest frame IS the pitch.
