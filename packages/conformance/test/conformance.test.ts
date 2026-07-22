/**
 * The reference implementation (@sourcedhq/core) must pass its own yardstick.
 * Every case is a named test so a failure points straight at the guarantee.
 */
import { describe, expect, it } from "vitest";
import { assess } from "@sourcedhq/core";
import { CASES, runConformance, badge, score } from "@sourcedhq/conformance";

describe("@sourcedhq/core vs the conformance yardstick", () => {
  for (const c of CASES) {
    it(`[${c.guarantee}] ${c.id} — ${c.title}`, async () => {
      const result = await c.run(assess);
      expect(result.detail).toBeTruthy();
      expect(result.pass, result.detail).toBe(true);
    });
  }
});

describe("conformance badge", () => {
  it("generates valid SVG for passing suite", async () => {
    const result = await runConformance();
    const svg = badge(result);
    expect(svg).toContain("<svg");
    expect(svg).toContain("sourced-conformant");
    expect(svg).toContain(`${result.passed}/${result.passed + result.failed}`);
    expect(svg).toContain("#2d8f4e");
  });

  it("generates red badge for failing suite", () => {
    const svg = badge({ passed: 10, failed: 4 });
    expect(svg).toContain("non-conformant");
    expect(svg).toContain("#d4111e");
    expect(svg).toContain("10/14");
  });

  it("score helper reports conformant when all pass", async () => {
    const result = await runConformance();
    const s = score(result);
    expect(s.conformant).toBe(true);
    expect(s.failedCases).toEqual([]);
  });

  it("score helper reports non-conformant with failed case ids", () => {
    const result = {
      passed: 12,
      failed: 2,
      results: [
        { pass: true, id: "g1-ok" },
        { pass: false, id: "g3-broken" },
        { pass: false, id: "g5-broken" },
      ],
    };
    const s = score(result);
    expect(s.conformant).toBe(false);
    expect(s.failedCases).toEqual(["g3-broken", "g5-broken"]);
  });
});
