import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { appendToFile, loadChain, verify } from "@sourced/log";

const dir = mkdtempSync(join(tmpdir(), "sourced-log-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("@sourced/log — file chain", () => {
  it("appends, reloads and verifies across processes boundaries", () => {
    const path = join(dir, "chain.jsonl");
    const T0 = Date.UTC(2026, 0, 1);
    appendToFile(path, { batch: 1 }, T0);
    appendToFile(path, { batch: 2 }, T0 + 1000);
    const chain = loadChain(path);
    expect(chain).toHaveLength(2);
    expect(verify(chain).ok).toBe(true);
    expect(chain[1].prevHash).toBe(chain[0].hash);
  });

  it("missing file is an empty chain", () => {
    expect(loadChain(join(dir, "nope.jsonl"))).toEqual([]);
  });
});
