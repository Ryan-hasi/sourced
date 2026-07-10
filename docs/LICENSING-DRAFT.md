# Licensing — draft for the decision (NOT in force)

> Status: DRAFT. Nothing here is granted until Ryan decides. The repo stays
> "all rights reserved" meanwhile.

## Recommended model: the Firefox/VLC split — code open, NAME protected

**The insight:** for a building block, openness drives adoption (nobody
standardizes on a black box), but control lives in the brand, the yardstick
and the history — none of which a license gives away.

1. **Code (packages/*): MIT.** Anyone may use, embed, fork, sell. This is what
   makes agents, startups and enterprises adopt without a legal review. The
   code was never the moat (Sourced.md §14).
2. **Name & mark: reserved.** A TRADEMARK-POLICY.md states: forks may not be
   called "Sourced", may not use the ● mark, and may not claim to BE Sourced.
   Enforceable once the trademark is registered (CH ~550 CHF, EU ~850 EUR).
3. **The yardstick as the gate:** only engines that pass @sourcedhq/conformance
   may describe themselves as "Sourced-conformant" (spelled out in the policy).
   This is the seed of the trust-mark / certification program.
4. **What stays ours regardless of license:** the production archive and
   first-seen history, the anchored transparency chain, the hosted APIs, the
   independence map (when built), the domains, the mark.

## Alternatives considered

- **Keep everything closed:** kills the standard play; a primitive nobody can
  embed becomes a README. Also blocks the agent-distribution path (npx of a
  closed blob is legally murky and trust-poor).
- **Copyleft (AGPL):** maximal control on paper, but enterprises and toolmakers
  route around AGPL — adoption dies at legal. Wrong trade for a building block.
- **BSL / source-available:** middle ground; adds friction now for protection
  we get more cheaply via trademark + history. Revisit only if a hyperscaler
  starts free-riding hard.

## Sequence when Ryan says go

1. Add LICENSE (MIT) to packages/*, TRADEMARK-POLICY.md at root.
2. Flip the GitHub repo public (this is the moment the history becomes citable).
3. npm publish all packages (`--access public`).
4. File the CH/EU trademark when revenue or attention justifies it.
