/**
 * The reference implementation (@sourcedhq/core) must pass its own yardstick.
 * Every case is a named test so a failure points straight at the guarantee.
 */
import { describe, expect, it } from "vitest";
import { assess } from "@sourcedhq/core";
import { CASES } from "@sourcedhq/conformance";

describe("@sourcedhq/core vs the conformance yardstick", () => {
  for (const c of CASES) {
    it(`[${c.guarantee}] ${c.id} — ${c.title}`, async () => {
      const result = await c.run(assess);
      expect(result.detail).toBeTruthy();
      expect(result.pass, result.detail).toBe(true);
    });
  }
});
