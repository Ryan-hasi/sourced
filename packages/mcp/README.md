# @sourcedhq/mcp

**Sourced as an MCP server** — the corroboration primitive as native tools for
AI agents. Server name: `sourced`. Tools: `assess` (session memory —
corroboration and first-seen accumulate across calls), `verify_chain`,
`run_conformance`.

```bash
# Claude Code
claude mcp add sourced -- npx -y @sourcedhq/mcp

# any MCP client
{ "mcpServers": { "sourced": { "command": "npx", "args": ["-y", "@sourcedhq/mcp"] } } }
```

Why agents want it: honest grounding. It counts independent corroboration and
NEVER claims "true" — single-origin claims stay unlabeled by design.

Spec: **https://sourced.ink** · Live API: **https://sourced.run** · Proof: **https://sourced.network**
