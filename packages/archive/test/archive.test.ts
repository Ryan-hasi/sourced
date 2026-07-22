import { describe, expect, it, beforeEach } from "vitest";
import { assess, createMemoryStore, type Claim, type StoredEvent } from "@sourcedhq/core";
import { MemoryArchive, FileArchive, type ArchivedEvent } from "@sourcedhq/archive";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const now = Date.UTC(2026, 6, 22, 12, 0, 0);
const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();
function C(id: string, title: string, origin: string, offsetMs = 0): Claim {
  return { id, title, origin, publishedAt: at(offsetMs) };
}

describe("MemoryArchive", () => {
  let archive: MemoryArchive;

  beforeEach(() => {
    archive = new MemoryArchive();
  });

  it("starts empty", async () => {
    expect(await archive.count()).toBe(0);
    expect(await archive.query()).toEqual([]);
  });

  it("appends and retrieves events", async () => {
    const events: StoredEvent[] = [
      {
        key: "earthquake hits tokyo",
        title: "Earthquake hits Tokyo",
        origins: ["reuters", "bbc"],
        firstSeenAt: now - 3600_000,
        lastSeenAt: now,
      },
    ];
    await archive.append(events);
    expect(await archive.count()).toBe(1);
    const result = await archive.query();
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("earthquake hits tokyo");
    expect(result[0].archivedAt).toBeGreaterThan(0);
  });

  it("filters by origin", async () => {
    await archive.append([
      {
        key: "event-a",
        title: "Event A",
        origins: ["reuters", "bbc"],
        firstSeenAt: now - 7200_000,
        lastSeenAt: now - 3600_000,
      },
      {
        key: "event-b",
        title: "Event B",
        origins: ["ap", "afp"],
        firstSeenAt: now - 3600_000,
        lastSeenAt: now,
      },
    ]);
    const reutersEvents = await archive.query({ origin: "reuters" });
    expect(reutersEvents).toHaveLength(1);
    expect(reutersEvents[0].key).toBe("event-a");
  });

  it("filters by time range", async () => {
    await archive.append([
      {
        key: "old-event",
        title: "Old event",
        origins: ["reuters"],
        firstSeenAt: now - 86400_000,
        lastSeenAt: now - 86400_000,
      },
      {
        key: "recent-event",
        title: "Recent event",
        origins: ["bbc"],
        firstSeenAt: now - 3600_000,
        lastSeenAt: now,
      },
    ]);
    const recent = await archive.query({ since: now - 7200_000 });
    expect(recent).toHaveLength(1);
    expect(recent[0].key).toBe("recent-event");
  });

  it("firstSeen returns earliest timestamp for a key", async () => {
    await archive.append([
      {
        key: "tracked-event",
        title: "Tracked event",
        origins: ["reuters"],
        firstSeenAt: now - 86400_000,
        lastSeenAt: now - 86400_000,
      },
    ]);
    expect(await archive.firstSeen("tracked-event")).toBe(now - 86400_000);
    expect(await archive.firstSeen("nonexistent")).toBeNull();
  });

  it("origins returns all origins for a key", async () => {
    await archive.append([
      {
        key: "multi-source",
        title: "Multi source event",
        origins: ["reuters", "bbc", "ap"],
        firstSeenAt: now - 3600_000,
        lastSeenAt: now,
      },
    ]);
    const origins = await archive.origins("multi-source");
    expect(origins).toEqual(["reuters", "bbc", "ap"]);
    expect(await archive.origins("nonexistent")).toEqual([]);
  });

  it("limits results", async () => {
    await archive.append(
      Array.from({ length: 10 }, (_, i) => ({
        key: `event-${i}`,
        title: `Event ${i}`,
        origins: ["src"],
        firstSeenAt: now - (10 - i) * 3600_000,
        lastSeenAt: now - (10 - i) * 3600_000,
      })),
    );
    const limited = await archive.query({ limit: 3 });
    expect(limited).toHaveLength(3);
  });
});

describe("FileArchive", () => {
  const testPath = resolve("C:\\Users\\ryanh\\AppData\\Local\\Temp\\opencode", "sourced-archive-test.jsonl");

  beforeEach(() => {
    if (existsSync(testPath)) unlinkSync(testPath);
  });

  it("creates file on first append", async () => {
    const archive = new FileArchive(testPath);
    await archive.append([
      {
        key: "test-event",
        title: "Test event",
        origins: ["reuters"],
        firstSeenAt: now,
        lastSeenAt: now,
      },
    ]);
    expect(existsSync(testPath)).toBe(true);
    const content = readFileSync(testPath, "utf-8");
    expect(content).toContain("test-event");
  });

  it("appends multiple times without data loss", async () => {
    const archive = new FileArchive(testPath);
    await archive.append([
      {
        key: "event-1",
        title: "Event 1",
        origins: ["reuters"],
        firstSeenAt: now - 3600_000,
        lastSeenAt: now - 3600_000,
      },
    ]);
    await archive.append([
      {
        key: "event-2",
        title: "Event 2",
        origins: ["bbc"],
        firstSeenAt: now,
        lastSeenAt: now,
      },
    ]);
    expect(await archive.count()).toBe(2);
    const all = await archive.query();
    expect(all.map((e) => e.key)).toEqual(["event-1", "event-2"]);
  });

  it("empty append is a no-op", async () => {
    const archive = new FileArchive(testPath);
    await archive.append([]);
    expect(existsSync(testPath)).toBe(false);
  });
});

describe("archive integration with assess()", () => {
  it("receives retired events from assess", async () => {
    const store = createMemoryStore();
    const archive = new MemoryArchive();
    const farPast = now - 37 * 3600_000;

    await assess(
      [C("old", "Old event from yesterday", "reuters")],
      { store, now: farPast },
    );

    await assess(
      [C("new", "Completely new event today", "bbc")],
      { store, now, archive: (retired) => archive.append(retired) },
    );

    const archived = await archive.query();
    expect(archived.length).toBeGreaterThanOrEqual(1);
    expect(archived[0].key).toContain("old");
  });
});
