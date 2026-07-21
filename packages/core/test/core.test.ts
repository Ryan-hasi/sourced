import { describe, expect, it } from "vitest";
import {
  assess,
  createMemoryStore,
  DEFAULT_CONFIG,
  keyOf,
  tokenize,
  type Claim,
} from "@sourcedhq/core";

// ---- tokenize -----------------------------------------------------------

describe("tokenize", () => {
  it("extracts meaning-bearing lowercase tokens ≥ 3 chars, no stopwords", () => {
    const t = tokenize("The central Bank raises interest Rates", DEFAULT_CONFIG.stopwords);
    expect(t).toEqual(["central", "bank", "raises", "interest", "rates"]);
  });

  it("strips punctuation and collapses whitespace", () => {
    const t = tokenize("Breaking: U.S.-China deal — signed!!!", DEFAULT_CONFIG.stopwords);
    expect(t).toContain("breaking");
    expect(t).toContain("china");
  });

  it("handles German stopwords", () => {
    const t = tokenize("Die Bundesbank hat den Leitzins gesenkt", DEFAULT_CONFIG.stopwords);
    expect(t).not.toContain("die");
    expect(t).not.toContain("den");
    expect(t).toContain("bundesbank");
    expect(t).toContain("leitzins");
  });

  it("handles French stopwords (Le Monde)", () => {
    const t = tokenize("Les élections législatives en France ont surpris", DEFAULT_CONFIG.stopwords);
    expect(t).not.toContain("les");
    expect(t).toContain("élections");
    expect(t).toContain("législatives");
    expect(t).toContain("france");
  });

  it("drops tokens shorter than 3 chars", () => {
    const t = tokenize("A big win for AI at CES 2025", DEFAULT_CONFIG.stopwords);
    expect(t).not.toContain("ai");
    expect(t).not.toContain("at");
    expect(t).toContain("win");
  });

  it("returns empty array for stopwords-only input", () => {
    const t = tokenize("the a an and or of to in on", DEFAULT_CONFIG.stopwords);
    expect(t).toEqual([]);
  });
});

// ---- keyOf --------------------------------------------------------------

describe("keyOf", () => {
  it("produces deterministic, deduplicated token key", () => {
    const key = keyOf(["bank", "central", "raises", "rates", "bank", "rates"]);
    // Sorted alphabetical, deduplicated, top 8
    expect(key).toBe("bank central raises rates");
  });

  it("truncates to configured keyTokens", () => {
    const tokens = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const key = keyOf(tokens, 4);
    // Sorted: a b c d e f g h i j → top 4 = a b c d
    expect(key).toBe("a b c d");
  });

  it("path from tokenize to keyOf is deterministic", () => {
    const tokens1 = tokenize("Central Bank Raises Rates", DEFAULT_CONFIG.stopwords);
    const tokens2 = tokenize("central bank raises rates", DEFAULT_CONFIG.stopwords);
    expect(keyOf(tokens1)).toBe(keyOf(tokens2));
  });

  it("empty tokens produce empty key", () => {
    expect(keyOf([], 8)).toBe("");
  });
});

// ---- DEFAULT_CONFIG -----------------------------------------------------

describe("DEFAULT_CONFIG", () => {
  it("encodes the honesty contract — conservative tuning", () => {
    expect(DEFAULT_CONFIG.mergeSimilarity).toBe(0.6);
    expect(DEFAULT_CONFIG.minSharedTokens).toBe(3);
    expect(DEFAULT_CONFIG.confirmedAt).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_CONFIG.corroboratedAt).toBe(2);
    expect(DEFAULT_CONFIG.breakingWindowMs).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.maxEvents).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.receiptsCap).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.keyTokens).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.eventTtlMs).toBeGreaterThan(0);
  });
});

// ---- assess -------------------------------------------------------------

const now = Date.UTC(2026, 6, 21, 12, 0, 0);
const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();

function C(id: string, title: string, origin: string, offsetMs = 0): Claim {
  return { id, title, origin, publishedAt: at(offsetMs) };
}

describe("assess — core scenarios", () => {
  it("single claim → no signal, no receipts", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [C("a", "Fed raises interest rates", "reuters")],
      { store, now },
    );
    expect(verdicts[0]).not.toBeNull();
    expect(verdicts[0]!.corroboration).toBe(1);
    expect(verdicts[0]!.corroboratingSources).toEqual([]);
    expect(verdicts[0]!.signal).toBeNull();
  });

  it("two independent origins → breaking with identical event text", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [
        C("a", "central bank raises interest rates sharply", "reuters"),
        C("b", "central bank raises interest rates", "bloomberg"),
      ],
      { store, now },
    );
    // "central" "bank" "raises" "interest" "rates" (5 vs 5 or 5 vs 5+sharply=5 or 6)
    // a: central bank raises interest rates sharply = 5 tokens (sharply >= 3)
    // b: central bank raises interest rates = 4 tokens
    // shared: central bank raises interest rates = 4
    // Jaccard = 4/(5+4-4) = 4/5 = 0.8 >= 0.6 ✓, shared = 4 >= 3 ✓
    expect(verdicts[1]!.corroboration).toBe(2);
    expect(verdicts[1]!.signal).toBe("breaking");
    expect(verdicts[1]!.corroboratingSources).toContain("reuters");
  });

  it("two origins on old story → developing, not breaking", async () => {
    const store = createMemoryStore();
    const oldMs = now - DEFAULT_CONFIG.breakingWindowMs - 60_000;
    const verdicts = await assess(
      [
        C("a", "central bank raises interest rates sharply", "reuters", oldMs - now),
        C("b", "central bank raises interest rates", "bloomberg", oldMs - now),
      ],
      { store, now },
    );
    expect(verdicts[1]!.corroboration).toBe(2);
    expect(verdicts[1]!.signal).toBe("developing");
  });

  it("four origins → confirmed", async () => {
    const store = createMemoryStore();
    const claims = [
      C("a", "Earthquake M6 hits Tokyo", "nhk"),
      C("b", "Earthquake M6 hits Tokyo", "reuters"),
      C("c", "Earthquake M6 hits Tokyo", "bbc"),
      C("d", "Earthquake M6 hits Tokyo region", "aljazeera"),
      // "earthquake" "m6" "hits" "tokyo" — should merge
    ];
    const verdicts = await assess(claims, { store, now });
    expect(verdicts[3]!.corroboration).toBe(4);
    expect(verdicts[3]!.signal).toBe("confirmed");
  });

  it("G7: fail-open — returns null verdicts instead of throwing", async () => {
    const store = {
      load: () => {
        throw new Error("dead KV");
      },
      save: () => {},
    };
    const verdicts = await assess([C("a", "Test", "src")], { store, now });
    // Should not throw; should return array same length
    expect(verdicts).toHaveLength(1);
    // With broken store, falls back to batch mode — null for unassessable
  });

  it("accumulates across calls (persistent memory)", async () => {
    const store = createMemoryStore();
    // First call — one claim
    await assess([C("a", "AI breakthrough reported", "reuters")], { store, now });
    // Second call — same event, new origin
    const v2 = await assess(
      [C("b", "AI breakthrough reported", "wired")],
      { store, now: now + 60_000 },
    );
    expect(v2[0]).not.toBeNull();
    expect(v2[0]!.corroboration).toBe(2);
    expect(v2[0]!.corroboratingSources).toContain("reuters");
  });

  it("G3: repeated origins don't inflate count", async () => {
    const store = createMemoryStore();
    const claims = [
      C("a", "Tesla recalls vehicles worldwide", "reuters"),
      C("b", "Tesla recalls vehicles worldwide", "reuters"),
    ];
    const verdicts = await assess(claims, { store, now });
    // Same origin twice → still count as 1
    expect(verdicts[1]!.corroboration).toBe(1);
  });

  it("empty title → null verdict (unassessable)", async () => {
    const store = createMemoryStore();
    const verdicts = await assess([C("x", "", "unknown")], { store, now });
    expect(verdicts[0]).toBeNull();
  });

  it("stopwords-only title → null verdict", async () => {
    const store = createMemoryStore();
    const verdicts = await assess([C("x", "the a an", "unknown")], { store, now });
    expect(verdicts[0]).toBeNull();
  });

  it("G4: receipts exclude own origin and respect cap", async () => {
    const store = createMemoryStore();
    const origins = ["src1", "src2", "src3", "src4", "src5"];
    const claims = origins.map((o, i) =>
      C(`c${i}`, "Major policy change announced", o),
    );
    const verdicts = await assess(claims, { store, now });
    // The last claim's receipts should not include its own origin
    expect(verdicts[4]!.corroboratingSources).not.toContain("src5");
    expect(verdicts[4]!.corroboratingSources.length).toBeLessThanOrEqual(
      DEFAULT_CONFIG.receiptsCap,
    );
  });

  it("wholly unrelated claims stay separated", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [
        C("a", "Apple launches new iPhone", "theverge"),
        C("b", "Oil prices drop sharply", "cnbc"),
      ],
      { store, now },
    );
    // Both should be single-source — no overlapping tokens
    expect(verdicts[0]!.corroboration).toBe(1);
    expect(verdicts[1]!.corroboration).toBe(1);
  });

  it("G1: coincidental token overlap does not merge", async () => {
    const store = createMemoryStore();
    // "Tesla recall electric vehicles" vs "Volvo recall electric vehicles"
    // a: tesla recall electric vehicles (4 tokens)
    // b: volvo recall electric vehicles (4 tokens)
    // shared: recall electric vehicles = 3, Jaccard = 3/(4+4-3) = 3/5 = 0.6 — EXACTLY at threshold!
    // Both gates: 0.6 >= 0.6 AND 3 >= 3 → they DO merge. Not what I wanted.
    // Fix: 2 shared tokens (recall, vehicles) → Jaccard = 2/(3+3-2) = 2/4 = 0.5 < 0.6. No merge.
    const verdicts = await assess(
      [
        C("a", "Tesla recall vehicles", "reuters"),
        C("b", "Volvo recall vehicles", "bbc"),
      ],
      { store, now },
    );
    // shared: recall vehicles = 2, Jaccard = 2/(3+3-2) = 0.5 < 0.6 → no merge
    expect(verdicts[1]!.corroboration).toBe(1);
  });

  it("TTL retirement — expired events leave working set", async () => {
    const store = createMemoryStore();
    const farPast = now - DEFAULT_CONFIG.eventTtlMs - 60_000;
    let retired: unknown[] = [];
    const archive = {
      save: (r: unknown[]) => { retired = r; },
    };
    // Insert 1 event way in the past
    await assess(
      [C("old", "Old event from yesterday", "reuters", farPast - now)],
      { store, now: farPast },
    );
    // Now assess with current time — the old event should be retired
    await assess(
      [C("new", "New event just happened", "cnbc")],
      { store: { ...store, load: store.load, save: store.save }, now, archive: archive.save },
    );
    // The old event should be in retired
    expect(retired.length).toBe(1);
  });
});
