import { beforeEach, describe, expect, it } from "vitest";
import { handle, resetSession } from "@sourcedhq/mcp";

const rpc = (method: string, params?: unknown, id: number | undefined = 1) =>
  handle({ jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method, params } as Record<string, unknown>);

const toolResult = (res: Record<string, unknown> | null) => {
  const r = (res?.result ?? {}) as { content: { text: string }[] };
  return JSON.parse(r.content[0].text);
};

beforeEach(() => resetSession());

describe("@sourcedhq/mcp — protocol", () => {
  it("initialize echoes protocol version and identifies as 'sourced'", async () => {
    const res = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const result = res?.result as Record<string, unknown>;
    expect((result.serverInfo as Record<string, unknown>).name).toBe("sourced");
    expect(result.protocolVersion).toBe("2025-06-18");
  });

  it("notifications get no response", async () => {
    expect(await handle({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
  });

  it("tools/list exposes the four tools with schemas", async () => {
    const res = await rpc("tools/list");
    const tools = (res?.result as { tools: { name: string; inputSchema: unknown }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(["assess", "verify_chain", "run_conformance", "assess_agent_consensus"]);
    for (const t of tools) expect(t.inputSchema).toBeTruthy();
  });

  it("unknown method returns -32601", async () => {
    const res = await rpc("resources/list");
    expect((res?.error as { code: number }).code).toBe(-32601);
  });
});

describe("@sourcedhq/mcp — tools", () => {
  it("assess corroborates across origins and keeps session memory across calls", async () => {
    const claim = (id: string, origin: string) => ({
      id, origin,
      title: "Major dam breach reported upstream",
      publishedAt: new Date().toISOString(),
    });
    const r1 = toolResult(await rpc("tools/call", { name: "assess", arguments: { claims: [claim("a", "reuters")] } }));
    expect(r1.verdicts[0].corroboration).toBe(1);
    expect(r1.verdicts[0].signal).toBeNull();
    // second call, different origin — session memory must accumulate
    const r2 = toolResult(await rpc("tools/call", { name: "assess", arguments: { claims: [claim("b", "bbc")] } }));
    expect(r2.verdicts[0].corroboration).toBe(2);
    expect(r2.verdicts[0].corroboratingSources).toEqual(["reuters"]);
  });

  it("assess with fresh: true is isolated", async () => {
    const claim = { id: "a", title: "Isolated batch corroboration check", origin: "x", publishedAt: new Date().toISOString() };
    await rpc("tools/call", { name: "assess", arguments: { claims: [claim] } });
    const r = toolResult(await rpc("tools/call", { name: "assess", arguments: { claims: [{ ...claim, id: "b", origin: "y" }], fresh: true } }));
    expect(r.verdicts[0].corroboration).toBe(1); // did not see the session's 'x'
  });

  it("verify_chain validates and reports breaks", async () => {
    const ok = toolResult(await rpc("tools/call", { name: "verify_chain", arguments: { chain: [] } }));
    expect(ok.ok).toBe(true);
    const bad = toolResult(await rpc("tools/call", {
      name: "verify_chain",
      arguments: { chain: [{ seq: 0, ts: 1, payloadHash: "x", prevHash: "", hash: "forged" }] },
    }));
    expect(bad.ok).toBe(false);
    expect(bad.badIndex).toBe(0);
  });

  it("run_conformance passes the full suite in-process", async () => {
    const r = toolResult(await rpc("tools/call", { name: "run_conformance", arguments: {} }));
    expect(r.failed).toBe(0);
    expect(r.passed).toBeGreaterThanOrEqual(14);
  });

  it("assess_agent_consensus measures multi-model LLM output corroboration", async () => {
    const r = toolResult(await rpc("tools/call", {
      name: "assess_agent_consensus",
      arguments: {
        outputs: [
          { model: "gemini-1.5-pro", output: "Database migration requires rebuilding user indices" },
          { model: "claude-3.5-sonnet", output: "Database migration requires rebuilding user indices" },
        ],
      },
    }));
    expect(r.consensusVerdicts).toHaveLength(2);
    expect(r.consensusVerdicts[1].corroboration).toBe(2);
    expect(r.consensusVerdicts[1].confidence).toBe("HIGH_CONFIDENCE_AUTO_EXECUTE");
  });
});
