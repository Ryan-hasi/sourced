/**
 * File-backed chain storage: one JSON record per line (JSONL). Append-only by
 * construction — the natural shape for a transparency log on disk.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { LogRecord } from "./index.js";
import { append } from "./index.js";

/** Load a chain from a JSONL file. Missing file → empty chain. */
export function loadChain(path: string): LogRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as LogRecord);
}

/** Append a payload to the chain file and return the new record. */
export function appendToFile(path: string, payload: unknown, ts: number): LogRecord {
  const chain = loadChain(path);
  const record = append(chain, payload, ts);
  appendFileSync(path, JSON.stringify(record) + "\n", "utf8");
  return record;
}
