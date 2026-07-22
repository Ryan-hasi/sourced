/**
 * @sourcedhq/archive — persistent event history.
 *
 * The working set stays bounded (36h/400 events) for matching performance;
 * the ARCHIVE is unbounded — every event, every origin, every first-seen
 * timestamp, forever. This is the compounding moat: a copycat starting
 * tomorrow begins with zero history. Every day of operation widens the gap.
 *
 * Two storage backends:
 *   - FileArchive: JSONL file, append-only, for local/CLI use.
 *   - KVArchive: key-value store adapter for hosted API use.
 */

import type { StoredEvent } from "@sourcedhq/core";

export type ArchivedEvent = StoredEvent & {
  archivedAt: number;
};

export type ArchiveQuery = {
  since?: number;
  until?: number;
  origin?: string;
  keyPrefix?: string;
  limit?: number;
};

export interface ArchiveStore {
  append(events: StoredEvent[]): void | Promise<void>;
  query(filter?: ArchiveQuery): Promise<ArchivedEvent[]>;
  count(): Promise<number>;
  firstSeen(key: string): Promise<number | null>;
  origins(key: string): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// File-backed archive (JSONL, append-only)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export class FileArchive implements ArchiveStore {
  private path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  private ensureDir(): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  async append(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) return;
    this.ensureDir();
    const now = Date.now();
    const lines = events
      .map((e) => JSON.stringify({ ...e, archivedAt: now }))
      .join("\n");
    const existing = existsSync(this.path)
      ? readFileSync(this.path, "utf-8")
      : "";
    const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
    writeFileSync(this.path, existing + separator + lines + "\n", "utf-8");
  }

  private loadAll(): ArchivedEvent[] {
    if (!existsSync(this.path)) return [];
    const content = readFileSync(this.path, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line) as ArchivedEvent);
  }

  async query(filter?: ArchiveQuery): Promise<ArchivedEvent[]> {
    let events = this.loadAll();
    if (filter) {
      if (filter.since != null) {
        events = events.filter((e) => e.firstSeenAt >= filter.since!);
      }
      if (filter.until != null) {
        events = events.filter((e) => e.firstSeenAt <= filter.until!);
      }
      if (filter.origin) {
        const o = filter.origin.toLowerCase();
        events = events.filter((e) =>
          e.origins.some((orig) => orig.toLowerCase() === o),
        );
      }
      if (filter.keyPrefix) {
        events = events.filter((e) => e.key.startsWith(filter.keyPrefix!));
      }
      if (filter.limit != null && filter.limit > 0) {
        events = events.slice(-filter.limit);
      }
    }
    return events;
  }

  async count(): Promise<number> {
    return this.loadAll().length;
  }

  async firstSeen(key: string): Promise<number | null> {
    const events = this.loadAll();
    const match = events.find((e) => e.key === key);
    return match ? match.firstSeenAt : null;
  }

  async origins(key: string): Promise<string[]> {
    const events = this.loadAll();
    const match = events.find((e) => e.key === key);
    return match ? match.origins : [];
  }
}

// ---------------------------------------------------------------------------
// KV-backed archive (for hosted API — Upstash/Vercel KV)
// ---------------------------------------------------------------------------

export interface KVClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

export class KVArchive implements ArchiveStore {
  private kv: KVClient;
  private prefix: string;
  private metaKey: string;

  constructor(kv: KVClient, prefix = "sourced:archive:") {
    this.kv = kv;
    this.prefix = prefix;
    this.metaKey = `${prefix}_meta`;
  }

  private bucketKey(ts: number): string {
    const d = new Date(ts);
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return `${this.prefix}${month}`;
  }

  private monthKeys(from?: Date, to?: Date): string[] {
    const end = to ?? new Date();
    const start = from ?? new Date(Date.UTC(end.getUTCFullYear() - 2, end.getUTCMonth(), 1));
    const keys: string[] = [];
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      keys.push(`${this.prefix}${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
  }

  async append(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) return;
    const now = Date.now();
    const buckets = new Map<string, ArchivedEvent[]>();
    for (const e of events) {
      const key = this.bucketKey(e.firstSeenAt);
      if (!buckets.has(key)) {
        const existing = (await this.kv.get<ArchivedEvent[]>(key)) ?? [];
        buckets.set(key, existing);
      }
      buckets.get(key)!.push({ ...e, archivedAt: now });
    }
    for (const [key, items] of buckets) {
      await this.kv.set(key, items);
    }
    const meta = (await this.kv.get<{ total: number }>(this.metaKey)) ?? { total: 0 };
    await this.kv.set(this.metaKey, { total: meta.total + events.length, updatedAt: now });
  }

  async query(filter?: ArchiveQuery): Promise<ArchivedEvent[]> {
    const sinceDate = filter?.since ? new Date(filter.since) : undefined;
    const untilDate = filter?.until ? new Date(filter.until) : undefined;
    const keys = this.monthKeys(sinceDate, untilDate);

    let events: ArchivedEvent[] = [];
    const hardLimit = filter?.limit ?? 10_000;

    for (const key of keys) {
      if (events.length >= hardLimit) break;
      const bucket = (await this.kv.get<ArchivedEvent[]>(key)) ?? [];
      events.push(...bucket);
    }

    if (filter) {
      if (filter.since != null) {
        events = events.filter((e) => e.firstSeenAt >= filter.since!);
      }
      if (filter.until != null) {
        events = events.filter((e) => e.firstSeenAt <= filter.until!);
      }
      if (filter.origin) {
        const o = filter.origin.toLowerCase();
        events = events.filter((e) =>
          e.origins.some((orig) => orig.toLowerCase() === o),
        );
      }
      if (filter.keyPrefix) {
        events = events.filter((e) => e.key.startsWith(filter.keyPrefix!));
      }
    }

    if (filter?.limit != null && filter.limit > 0) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  async count(): Promise<number> {
    const meta = (await this.kv.get<{ total: number }>(this.metaKey)) ?? { total: 0 };
    return meta.total;
  }

  async firstSeen(key: string): Promise<number | null> {
    const events = await this.query({ keyPrefix: key, limit: 1 });
    const match = events.find((e) => e.key === key);
    return match ? match.firstSeenAt : null;
  }

  async origins(key: string): Promise<string[]> {
    const events = await this.query({ keyPrefix: key, limit: 1 });
    const match = events.find((e) => e.key === key);
    return match ? match.origins : [];
  }
}

// ---------------------------------------------------------------------------
// In-memory archive (tests, demos)
// ---------------------------------------------------------------------------

export class MemoryArchive implements ArchiveStore {
  private events: ArchivedEvent[] = [];

  async append(events: StoredEvent[]): Promise<void> {
    const now = Date.now();
    for (const e of events) {
      this.events.push({ ...e, archivedAt: now });
    }
  }

  async query(filter?: ArchiveQuery): Promise<ArchivedEvent[]> {
    let result = [...this.events];
    if (filter) {
      if (filter.since != null) {
        result = result.filter((e) => e.firstSeenAt >= filter.since!);
      }
      if (filter.until != null) {
        result = result.filter((e) => e.firstSeenAt <= filter.until!);
      }
      if (filter.origin) {
        const o = filter.origin.toLowerCase();
        result = result.filter((e) =>
          e.origins.some((orig) => orig.toLowerCase() === o),
        );
      }
      if (filter.keyPrefix) {
        result = result.filter((e) => e.key.startsWith(filter.keyPrefix!));
      }
      if (filter.limit != null && filter.limit > 0) {
        result = result.slice(-filter.limit);
      }
    }
    return result;
  }

  async count(): Promise<number> {
    return this.events.length;
  }

  async firstSeen(key: string): Promise<number | null> {
    const match = this.events.find((e) => e.key === key);
    return match ? match.firstSeenAt : null;
  }

  async origins(key: string): Promise<string[]> {
    const match = this.events.find((e) => e.key === key);
    return match ? match.origins : [];
  }

  snapshot(): ArchivedEvent[] {
    return structuredClone(this.events);
  }
}
