import { describe, expect, it } from "vitest";
import {
  assess,
  createMemoryStore,
  resolveOrigin,
  deduplicateOrigins,
  SEED_INDEPENDENCE_MAP,
  type Claim,
  type IndependenceMap,
} from "@sourcedhq/core";

const now = Date.UTC(2026, 6, 22, 12, 0, 0);
const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();
function C(id: string, title: string, origin: string, offsetMs = 0): Claim {
  return { id, title, origin, publishedAt: at(offsetMs) };
}

describe("resolveOrigin", () => {
  it("returns lowercased origin when no map provided", () => {
    expect(resolveOrigin("BBC News")).toBe("bbc news");
  });

  it("resolves known origin to canonical", () => {
    expect(resolveOrigin("BBC News", SEED_INDEPENDENCE_MAP)).toBe("bbc");
    expect(resolveOrigin("bbc world service", SEED_INDEPENDENCE_MAP)).toBe("bbc");
    expect(resolveOrigin("MSNBC", SEED_INDEPENDENCE_MAP)).toBe("nbc-universal");
    expect(resolveOrigin("CNBC", SEED_INDEPENDENCE_MAP)).toBe("nbc-universal");
    expect(resolveOrigin("Fox News", SEED_INDEPENDENCE_MAP)).toBe("news-corp");
  });

  it("unknown origins resolve to themselves", () => {
    expect(resolveOrigin("tiny-local-paper", SEED_INDEPENDENCE_MAP)).toBe("tiny-local-paper");
  });

  it("case-insensitive lookup", () => {
    expect(resolveOrigin("REUTERS", SEED_INDEPENDENCE_MAP)).toBe("reuters");
    expect(resolveOrigin("Reuters", SEED_INDEPENDENCE_MAP)).toBe("reuters");
  });
});

describe("deduplicateOrigins", () => {
  it("collapses origins sharing a canonical", () => {
    const result = deduplicateOrigins(
      ["BBC News", "bbc world", "reuters", "Reuters Wire"],
      SEED_INDEPENDENCE_MAP,
    );
    expect(result).toEqual(["bbc", "reuters"]);
  });

  it("without map, deduplicates by lowercase only", () => {
    const result = deduplicateOrigins(["BBC", "bbc", "Reuters"]);
    expect(result).toEqual(["bbc", "reuters"]);
  });

  it("keeps unknown origins as-is", () => {
    const result = deduplicateOrigins(
      ["local-paper-a", "local-paper-b", "BBC"],
      SEED_INDEPENDENCE_MAP,
    );
    expect(result).toEqual(["local-paper-a", "local-paper-b", "bbc"]);
  });
});

describe("SEED_INDEPENDENCE_MAP", () => {
  it("has no duplicate members across groups", () => {
    const seen = new Map<string, string>();
    for (const g of SEED_INDEPENDENCE_MAP.groups) {
      for (const m of g.members) {
        const lower = m.toLowerCase();
        if (seen.has(lower)) {
          expect.fail(`duplicate member "${m}" in groups "${seen.get(lower)}" and "${g.canonical}"`);
        }
        seen.set(lower, g.canonical);
      }
    }
  });

  it("every canonical is itself a member of its group", () => {
    for (const g of SEED_INDEPENDENCE_MAP.groups) {
      const memberLowers = g.members.map((m) => m.toLowerCase());
      expect(memberLowers).toContain(g.canonical.toLowerCase());
    }
  });
});

describe("assess with independence map", () => {
  it("collapses CNBC + MSNBC to one independent unit", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [
        C("a", "Fed raises rates by half point", "cnbc"),
        C("b", "Fed raises rates by half point", "msnbc"),
      ],
      { store, now, independenceMap: SEED_INDEPENDENCE_MAP },
    );
    // Both are NBC-Universal → corroboration = 1, no signal
    expect(verdicts[1]!.corroboration).toBe(1);
    expect(verdicts[1]!.signal).toBeNull();
  });

  it("counts truly independent origins separately", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [
        C("a", "Fed raises rates by half point", "reuters"),
        C("b", "Fed raises rates by half point", "bloomberg"),
        C("c", "Fed raises rates by half point", "cnbc"),
      ],
      { store, now, independenceMap: SEED_INDEPENDENCE_MAP },
    );
    // reuters, bloomberg, nbc-universal → 3 independent
    expect(verdicts[2]!.corroboration).toBe(3);
    expect(verdicts[2]!.signal).toBe("breaking");
  });

  it("four independent origins → confirmed even with map", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [
        C("a", "Earthquake hits coastal region", "reuters"),
        C("b", "Earthquake hits coastal region", "bbc"),
        C("c", "Earthquake hits coastal region", "guardian"),
        C("d", "Earthquake hits coastal region", "aljazeera"),
      ],
      { store, now, independenceMap: SEED_INDEPENDENCE_MAP },
    );
    expect(verdicts[3]!.corroboration).toBe(4);
    expect(verdicts[3]!.signal).toBe("confirmed");
  });

  it("without map, CNBC + MSNBC count as two (backward compatible)", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [
        C("a", "Fed raises rates by half point", "cnbc"),
        C("b", "Fed raises rates by half point", "msnbc"),
      ],
      { store, now },
    );
    expect(verdicts[1]!.corroboration).toBe(2);
    expect(verdicts[1]!.signal).toBe("breaking");
  });

  it("accumulates across calls with map", async () => {
    const store = createMemoryStore();
    await assess(
      [C("a", "Major trade deal signed today", "reuters")],
      { store, now, independenceMap: SEED_INDEPENDENCE_MAP },
    );
    const v2 = await assess(
      [C("b", "Major trade deal signed today", "bbc")],
      { store, now: now + 60_000, independenceMap: SEED_INDEPENDENCE_MAP },
    );
    expect(v2[0]!.corroboration).toBe(2);
    expect(v2[0]!.corroboratingSources).toContain("reuters");
  });

  it("receipts never show a collapsed duplicate of own origin", async () => {
    const store = createMemoryStore();
    const verdicts = await assess(
      [
        C("a", "Bank announces major policy shift", "cnn"),
        C("b", "Bank announces major policy shift", "msnbc"),
        C("c", "Bank announces major policy shift", "reuters"),
      ],
      { store, now, independenceMap: SEED_INDEPENDENCE_MAP },
    );
    // cnn claim: msnbc is different canonical (nbc-universal vs wbd-cnn)
    // msnbc claim: cnn is wbd-cnn, different from nbc-universal
    // All 3 are independent: wbd-cnn, nbc-universal, reuters → corro 3
    const cnnVerdict = verdicts[0]!;
    expect(cnnVerdict.corroboration).toBe(1); // only cnn at that point
    const reutersVerdict = verdicts[2]!;
    expect(reutersVerdict.corroboration).toBe(3);
    expect(reutersVerdict.corroboratingSources).not.toContain("reuters");
  });

  it("custom independence map works", async () => {
    const store = createMemoryStore();
    const customMap: IndependenceMap = {
      groups: [
        {
          canonical: "local-group",
          relation: "ownership",
          members: ["local-a", "local-b", "local-c"],
        },
      ],
    };
    const verdicts = await assess(
      [
        C("a", "City council votes on new budget", "local-a"),
        C("b", "City council votes on new budget", "local-b"),
        C("c", "City council votes on new budget", "local-c"),
      ],
      { store, now, independenceMap: customMap },
    );
    // All three are the same group → corroboration = 1
    expect(verdicts[2]!.corroboration).toBe(1);
    expect(verdicts[2]!.signal).toBeNull();
  });
});
