/**
 * @sourcedhq/anchor — public timestamp anchoring.
 *
 * Submits chain head hashes to OpenTimestamps calendar servers for
 * unfakeable proof of existence at a point in time.
 *
 * ## What this does
 *   1. Takes a SHA256 hash (typically a Sourced chain head)
 *   2. POSTs it to OpenTimestamps calendar servers via their REST API
 *   3. Receives a calendar commitment (pending proof)
 *   4. Stores the receipt for later verification
 *
 * ## What this does NOT do (scope)
 *   - Does NOT implement the full OTS binary serialization format
 *     (RFC draft) — that requires the `opentimestamps` npm package.
 *   - Does NOT upgrade pending receipts to Bitcoin-confirmed proofs.
 *     Calendar servers do this asynchronously (~2-24h). Upgrade
 *     requires the full OTS library.
 *   - Does NOT verify Merkle branches against the Bitcoin blockchain.
 *     That also requires the full OTS library.
 *
 * ## When to use this vs the full OTS library
 *   - This package: lightweight anchoring for CI/CD, daily cron jobs.
 *     Submits hashes, stores receipts. Sufficient for "we submitted
 *     this hash at time T and the calendar acknowledged it."
 *   - Full `opentimestamps` package: when you need to verify completed
 *     proofs against the Bitcoin blockchain, upgrade pending receipts,
 *     or produce standard `.ots` files that other tools can verify.
 *
 * ## Upgrade path
 *   When Bitcoin verification is needed, run the full OTS CLI:
 *   ```
 *   ots upgrade receipt.ots    # upgrades pending → bitcoin-confirmed
 *   ots verify receipt.ots     # verifies against blockchain
 *   ```
 */

import { createHash } from "node:crypto";

export type AnchorReceipt = {
  hash: string;
  timestamp: number;
  calendarUrl: string;
  commitment: string;
  status: "pending" | "confirmed";
};

export type AnchorResult = {
  receipts: AnchorReceipt[];
  failed: { calendarUrl: string; error: string }[];
};

const CALENDAR_SERVERS = [
  "https://alice.btc.calendar.opentimestamps.org",
  "https://bob.btc.calendar.opentimestamps.org",
  "https://finney.calendar.eternitywall.com",
];

async function submitWithRetry(
  hash: string,
  calendarUrl: string,
  retries = 2,
  timeoutMs = 10_000,
): Promise<AnchorReceipt> {
  const hashBytes = Buffer.from(hash, "hex");
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${calendarUrl}/digest`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: hashBytes.toString("latin1"),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const commitment = await response.text();

      if (!commitment || commitment.length < 10) {
        throw new Error("empty or malformed commitment from calendar");
      }

      return {
        hash,
        timestamp: Math.floor(Date.now() / 1000),
        calendarUrl,
        commitment,
        status: "pending",
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("calendar submission failed");
}

export async function submitToCalendar(
  hash: string,
  calendarUrl: string = CALENDAR_SERVERS[0],
): Promise<AnchorReceipt> {
  return submitWithRetry(hash, calendarUrl);
}

export async function anchorHash(
  hash: string,
  calendars: string[] = CALENDAR_SERVERS,
): Promise<AnchorResult> {
  const results = await Promise.allSettled(
    calendars.map((url) => submitWithRetry(hash, url)),
  );

  const receipts: AnchorReceipt[] = [];
  const failed: { calendarUrl: string; error: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      receipts.push(r.value);
    } else {
      failed.push({ calendarUrl: calendars[i], error: r.reason?.message ?? String(r.reason) });
    }
  }

  return { receipts, failed };
}

export function computeHash(data: string | Buffer): string {
  const input = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return createHash("sha256").update(input).digest("hex");
}

export function verifyReceipt(receipt: AnchorReceipt, expectedHash: string): {
  valid: boolean;
  reason?: string;
} {
  if (receipt.hash !== expectedHash) {
    return { valid: false, reason: `hash mismatch: receipt has ${receipt.hash}, expected ${expectedHash}` };
  }
  if (!receipt.commitment || receipt.commitment.length < 10) {
    return { valid: false, reason: "receipt has no valid commitment" };
  }
  if (!receipt.calendarUrl) {
    return { valid: false, reason: "receipt has no calendar URL" };
  }
  return { valid: true };
}

export { CALENDAR_SERVERS };
