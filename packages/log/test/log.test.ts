import { describe, expect, it } from "vitest";
import { append, canonicalize, head, verify, verifyPayloadAt, type LogRecord } from "@sourcedhq/log";

const T0 = Date.UTC(2026, 0, 1);

function buildChain(payloads: unknown[]): LogRecord[] {
  const chain: LogRecord[] = [];
  payloads.forEach((p, i) => chain.push(append(chain, p, T0 + i * 1000)));
  return chain;
}

describe("@sourcedhq/log — transparency chain", () => {
  it("builds and verifies a clean chain", () => {
    const chain = buildChain([{ batch: 1 }, { batch: 2 }, { batch: 3 }]);
    const res = verify(chain);
    expect(res.ok).toBe(true);
    expect(head(chain)).toBe(chain[2].hash);
  });

  it("canonicalization is key-order independent", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("detects a tampered payload hash", () => {
    const chain = buildChain([{ v: "honest" }, { v: "honest2" }]);
    chain[0] = { ...chain[0], payloadHash: "0".repeat(64) };
    const res = verify(chain);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.badIndex).toBe(0);
  });

  it("detects a rewritten record even when its own hash is recomputed", () => {
    const chain = buildChain([{ v: 1 }, { v: 2 }, { v: 3 }]);
    // Attacker rewrites record 1 completely and recomputes ITS hash…
    const forged = append(chain.slice(0, 1), { v: "forged" }, T0 + 1000);
    chain[1] = forged;
    // …but record 2 still points at the ORIGINAL hash → chain breaks.
    const res = verify(chain);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.badIndex).toBe(2);
  });

  it("proves a payload was committed at a position", () => {
    const batch = { verdicts: [{ corroboration: 3 }] };
    const chain = buildChain([{ x: 0 }, batch]);
    expect(verifyPayloadAt(chain, 1, { verdicts: [{ corroboration: 3 }] })).toBe(true);
    expect(verifyPayloadAt(chain, 1, { verdicts: [{ corroboration: 4 }] })).toBe(false);
  });

  it("detects sequence gaps", () => {
    const chain = buildChain([{ v: 1 }, { v: 2 }, { v: 3 }]);
    const cut = [chain[0], chain[2]];
    const res = verify(cut);
    expect(res.ok).toBe(false);
  });
});
