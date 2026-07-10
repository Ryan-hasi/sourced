/**
 * @sourced/log — the transparency log.
 *
 * Every verdict batch is appended to a hash chain: each record commits to the
 * previous record's hash (Certificate-Transparency style). Publish the chain
 * head anywhere public (a git commit, OpenTimestamps) and the entire history
 * up to that point becomes tamper-evident: rewriting ANY past verdict changes
 * every subsequent hash, including the anchored head.
 *
 * This is what makes "we have issued honest verdicts since day one" a
 * VERIFIABLE claim instead of a marketing line. Code can be cloned; an
 * anchored history cannot.
 *
 * Only dependency: node:crypto (SHA-256).
 */
import { createHash } from "node:crypto";

export { loadChain, appendToFile } from "./file.js";

export type LogRecord = {
  /** 0-based position in the chain. */
  seq: number;
  /** When this record was appended (epoch ms, injected for determinism). */
  ts: number;
  /** SHA-256 hex of the canonicalized payload. */
  payloadHash: string;
  /** Hash of the previous record ("" for the genesis record). */
  prevHash: string;
  /** SHA-256 hex over (seq | ts | payloadHash | prevHash). */
  hash: string;
};

export type VerifyResult =
  | { ok: true; length: number; head: string }
  | { ok: false; badIndex: number; reason: string };

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Canonical JSON: object keys sorted recursively, so the same payload always
 * hashes identically regardless of construction order.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortKeys((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

export function hashPayload(payload: unknown): string {
  return sha256(canonicalize(payload));
}

function recordHash(seq: number, ts: number, payloadHash: string, prevHash: string): string {
  return sha256(`${seq}|${ts}|${payloadHash}|${prevHash}`);
}

/**
 * Append a payload (e.g. a verdict batch) to the chain. Returns the new
 * record; the chain array is not mutated — append is `[...chain, record]`
 * at the call site, or use the returned record with your own storage.
 */
export function append(chain: LogRecord[], payload: unknown, ts: number): LogRecord {
  const seq = chain.length;
  const prevHash = seq === 0 ? "" : chain[seq - 1].hash;
  const payloadHash = hashPayload(payload);
  return { seq, ts, payloadHash, prevHash, hash: recordHash(seq, ts, payloadHash, prevHash) };
}

/** The chain head — the one hash to anchor publicly. */
export function head(chain: LogRecord[]): string | null {
  return chain.length === 0 ? null : chain[chain.length - 1].hash;
}

/**
 * Verify the whole chain: every record's hash must recompute, every link must
 * point at its predecessor, sequence numbers must be contiguous.
 */
export function verify(chain: LogRecord[]): VerifyResult {
  for (let i = 0; i < chain.length; i++) {
    const r = chain[i];
    if (r.seq !== i) return { ok: false, badIndex: i, reason: "sequence gap" };
    const expectedPrev = i === 0 ? "" : chain[i - 1].hash;
    if (r.prevHash !== expectedPrev) return { ok: false, badIndex: i, reason: "broken link" };
    if (recordHash(r.seq, r.ts, r.payloadHash, r.prevHash) !== r.hash) {
      return { ok: false, badIndex: i, reason: "hash mismatch" };
    }
  }
  return { ok: true, length: chain.length, head: head(chain) ?? "" };
}

/**
 * Verify that a specific payload is the one committed at position `seq`.
 * Together with a verified chain + anchored head, this proves the payload
 * existed unmodified when the head was anchored.
 */
export function verifyPayloadAt(chain: LogRecord[], seq: number, payload: unknown): boolean {
  const r = chain[seq];
  if (!r) return false;
  return r.payloadHash === hashPayload(payload);
}
