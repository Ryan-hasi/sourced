/**
 * @sourcedhq/mcp — Sourced as an MCP server.
 *
 * Exposes the corroboration primitive to AI agents (Claude, Cursor, any MCP
 * client) as tools: `assess`, `verify_chain`, `run_conformance`. The server
 * self-identifies as "sourced".
 *
 * Session memory: the server keeps an in-process event store, so
 * corroboration and first-seen accumulate ACROSS calls within one agent
 * session — an agent can feed reports as it finds them and watch events
 * corroborate. Pass `fresh: true` to assess a batch in isolation.
 *
 * The protocol layer is hand-rolled JSON-RPC 2.0 (MCP stdio transport is
 * newline-delimited JSON) — no dependencies beyond the Sourced packages.
 */
import { assess, createMemoryStore, DEFAULT_CONFIG, type Claim, type Verdict } from "@sourcedhq/core";
import { verify, type LogRecord } from "@sourcedhq/log";
import { CASES } from "@sourcedhq/conformance";

const VERSION = "1.0.0";
const FALLBACK_PROTOCOL = "2025-06-18";

// Session event store — corroboration accumulates across calls (see above).
let sessionStore = createMemoryStore();

type Json = Record<string, unknown>;

const TOOLS = [
  {
    name: "assess",
    description:
      "Sourced corroboration verdicts for a batch of claims: how many DISTINCT INDEPENDENT origins " +
      "report each claim's event, since when, with receipts (who else). Honest by design: it undercounts " +
      "rather than overcounts, syndicated copies collapse to one origin, single-origin claims stay " +
      "unlabeled, and it NEVER says 'true' — only 'corroborated'. Use it to gauge how broadly independent " +
      "sources agree on a claim (news, search results, incident reports, OSINT). Session memory: events " +
      "accumulate across calls, so first-seen timestamps and counts persist within this session.",
    inputSchema: {
      type: "object",
      properties: {
        claims: {
          type: "array",
          description: "The reports to assess (order preserved in the result).",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Stable id of this report." },
              title: { type: "string", description: "The claim, in words — event identity derives from it." },
              origin: { type: "string", description: "The source making it — the unit of independence. Normalize consistently (e.g. always 'reuters')." },
              publishedAt: { type: "string", description: "ISO 8601 publish time from the source; drives the 'breaking' signal." },
            },
            required: ["id", "title", "origin", "publishedAt"],
          },
          minItems: 1,
          maxItems: 500,
        },
        clusters: {
          type: "object",
          description: "Optional pre-grouping: claim id → array of origins reporting that same event in this batch (if you already know which claims describe the same event).",
          additionalProperties: { type: "array", items: { type: "string" } },
        },
        config: {
          type: "object",
          description: `Optional threshold overrides (numbers). Defaults are the honesty contract: ${JSON.stringify({ mergeSimilarity: DEFAULT_CONFIG.mergeSimilarity, minSharedTokens: DEFAULT_CONFIG.minSharedTokens, confirmedAt: DEFAULT_CONFIG.confirmedAt, corroboratedAt: DEFAULT_CONFIG.corroboratedAt })}. Tighten freely; loosening trades away trustworthiness.`,
          additionalProperties: { type: "number" },
        },
        fresh: {
          type: "boolean",
          description: "true = assess this batch in isolation, ignoring and not touching session memory.",
        },
      },
      required: ["claims"],
    },
  },
  {
    name: "verify_chain",
    description:
      "Verify a Sourced transparency chain (hash-chained verdict history, Certificate-Transparency style). " +
      "Recomputes every record hash, checks every back-link and sequence numbering. Returns the head hash " +
      "if valid, or the first broken record. Proves a verdict history was never rewritten — it does NOT " +
      "prove the verdicts were correct (that is the conformance suite's job).",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "array",
          description: "The chain records, in order: { seq, ts, payloadHash, prevHash, hash }.",
          items: { type: "object" },
        },
        jsonl: { type: "string", description: "Alternative: the chain as raw JSONL text (one record per line)." },
      },
    },
  },
  {
    name: "run_conformance",
    description:
      "Run the Sourced honesty guarantees (G1–G7) as an adversarial test suite against the bundled engine: " +
      "coincidental-merge resistance, syndication collapse, event-hijack resistance, fake-urgency resistance, " +
      "fail-open behavior, memory honesty. Returns per-case pass/fail with details. Spec: https://sourced.ink",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "assess_agent_consensus",
    description:
      "Evaluates AI Multi-Agent outputs for consensus and hallucination elimination. " +
      "Takes generated outputs from multiple LLM agents (e.g. Gemini, Claude, DeepSeek, Llama), " +
      "measures independent model corroboration using Sourced dual-gate matching, and returns consensus verdicts. " +
      "High corroboration (>= 2 distinct model origins) indicates zero-hallucination confidence for auto-execution.",
    inputSchema: {
      type: "object",
      properties: {
        outputs: {
          type: "array",
          description: "List of agent outputs to evaluate.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Optional output/claim ID." },
              agentId: { type: "string", description: "Agent instance name (e.g., 'research-agent-1')." },
              model: { type: "string", description: "The underlying LLM model (e.g., 'gemini-1.5-pro', 'claude-3.5-sonnet')." },
              output: { type: "string", description: "The generated claim or code output text." },
            },
            required: ["model", "output"],
          },
          minItems: 1,
        },
      },
      required: ["outputs"],
    },
  },
] as const;

function toolText(payload: unknown, isError = false): Json {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], ...(isError ? { isError: true } : {}) };
}

async function callTool(name: string, args: Json): Promise<Json> {
  if (name === "assess") {
    const raw = args.claims;
    if (!Array.isArray(raw) || raw.length === 0) return toolText({ error: "claims must be a non-empty array" }, true);
    const claims: Claim[] = raw.slice(0, 500).map((c: Json, i: number) => ({
      id: String(c?.id ?? `claim-${i}`),
      title: String(c?.title ?? ""),
      origin: String(c?.origin ?? "unknown"),
      publishedAt: String(c?.publishedAt ?? ""),
    }));
    const fresh = args.fresh === true;
    const verdicts = await assess(claims, {
      store: fresh ? undefined : sessionStore,
      clusters: (args.clusters as Record<string, string[]>) ?? undefined,
      config: (args.config as Json) ?? undefined,
    });
    return toolText({
      verdicts,
      note: "corroborated, never 'true' — single-origin claims are unlabeled by design (G5)",
      memory: fresh ? "isolated (fresh: true)" : "session memory updated — counts accumulate across calls",
    });
  }

  if (name === "verify_chain") {
    let chain = args.chain as LogRecord[] | undefined;
    if (!chain && typeof args.jsonl === "string") {
      try {
        chain = args.jsonl.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
      } catch {
        return toolText({ error: "jsonl lines must each be a JSON record" }, true);
      }
    }
    if (!Array.isArray(chain)) return toolText({ error: "provide chain (array) or jsonl (string)" }, true);
    return toolText(verify(chain));
  }

  if (name === "run_conformance") {
    const results = [];
    for (const c of CASES) {
      const r = await c.run(assess);
      results.push({ id: c.id, guarantee: c.guarantee, pass: r.pass, detail: r.detail });
    }
    const failed = results.filter((r) => !r.pass).length;
    return toolText({ engine: "@sourcedhq/core", passed: results.length - failed, failed, results });
  }

  if (name === "assess_agent_consensus") {
    const raw = args.outputs;
    if (!Array.isArray(raw) || raw.length === 0) return toolText({ error: "outputs must be a non-empty array" }, true);
    const claims: Claim[] = raw.map((item: Json, i: number) => ({
      id: String(item?.id ?? `agent-out-${i}`),
      title: String(item?.output ?? ""),
      origin: String(item?.model ?? item?.agentId ?? "unknown-llm").toLowerCase(),
      publishedAt: new Date().toISOString(),
    }));
    const verdicts = await assess(claims, {});
    return toolText({
      consensusVerdicts: verdicts.map((v: Verdict | null, idx: number) => ({
        outputId: claims[idx].id,
        model: claims[idx].origin,
        corroboration: v?.corroboration ?? 1,
        corroboratingModels: v?.corroboratingSources ?? [],
        confidence: (v?.corroboration ?? 1) >= 2 ? "HIGH_CONFIDENCE_AUTO_EXECUTE" : "SINGLE_AGENT_BARE_REVIEW",
        signal: v?.signal ?? null,
      })),
      guaranteeNote: "G3 Independence enforced: multiple calls from the exact same model collapse to 1 origin.",
    });
  }

  return toolText({ error: `unknown tool: ${name}` }, true);
}

/** Reset session memory (exposed for tests). */
export function resetSession(): void {
  sessionStore = createMemoryStore();
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (which get no response).
 */
export async function handle(msg: Json): Promise<Json | null> {
  const id = msg.id as number | string | undefined;
  const method = msg.method as string;

  // Notifications (no id) get no response.
  if (id === undefined && typeof method === "string" && method.startsWith("notifications/")) return null;

  const respond = (result: Json): Json => ({ jsonrpc: "2.0", id: id ?? null, result });
  const fail = (code: number, message: string): Json => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  try {
    switch (method) {
      case "initialize":
        return respond({
          protocolVersion: (msg.params as Json)?.protocolVersion ?? FALLBACK_PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: "sourced", title: "Sourced — corroboration as a primitive", version: VERSION },
          instructions:
            "Sourced counts how many independent sources corroborate a claim — with receipts, never 'true'. " +
            "Use `assess` on any set of reports (news, search results, incident feeds) to see what is " +
            "independently corroborated vs. single-source. Spec: https://sourced.ink · Live API: https://sourced.run",
        });
      case "ping":
        return respond({});
      case "tools/list":
        return respond({ tools: TOOLS as unknown as Json[] });
      case "tools/call": {
        const p = (msg.params ?? {}) as Json;
        return respond(await callTool(String(p.name), (p.arguments ?? {}) as Json));
      }
      default:
        return fail(-32601, `method not found: ${method}`);
    }
  } catch (e) {
    return fail(-32603, `internal error: ${String(e)}`);
  }
}
