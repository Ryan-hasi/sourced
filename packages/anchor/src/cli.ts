#!/usr/bin/env node
/**
 * sourced-anchor-ts — submit chain heads to OpenTimestamps calendar servers.
 *
 * Usage:
 *   sourced-anchor-ts <chain-file> [--calendars <url1,url2,...>]
 *
 * Reads the last line of a chain file (JSONL), extracts the head hash,
 * and submits it to calendar servers for public timestamping.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { anchorHash, CALENDAR_SERVERS } from "./index.js";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: sourced-anchor-ts <chain-file> [--calendars <url1,url2,...>]

Submits the chain head hash to OpenTimestamps calendar servers.

Options:
  --calendars <urls>  Comma-separated calendar server URLs
                      (default: ${CALENDAR_SERVERS.join(", ")})

The receipt is printed to stdout as JSON.`);
  process.exit(0);
}

const chainFile = resolve(args[0]);
let calendars = CALENDAR_SERVERS;

const calendarsIdx = args.indexOf("--calendars");
if (calendarsIdx !== -1 && args[calendarsIdx + 1]) {
  calendars = args[calendarsIdx + 1].split(",").map((s) => s.trim());
}

try {
  const content = readFileSync(chainFile, "utf-8").trim();
  const lines = content.split("\n");
  const lastLine = lines[lines.length - 1];

  if (!lastLine) {
    console.error("Chain file is empty");
    process.exit(1);
  }

  const record = JSON.parse(lastLine);
  const hash = record.hash;

  if (!hash || typeof hash !== "string" || hash.length !== 64) {
    console.error("Invalid chain record: missing or malformed hash");
    process.exit(1);
  }

  console.error(`Submitting hash ${hash} to ${calendars.length} calendar(s)...`);

  const result = await anchorHash(hash, calendars);

  console.log(JSON.stringify(result, null, 2));
  console.error(`✓ Submitted to ${result.receipts.length}/${calendars.length} calendar(s)`);
  if (result.failed.length > 0) {
    console.error(`✗ ${result.failed.length} calendar(s) failed:`);
    for (const f of result.failed) {
      console.error(`  ${f.calendarUrl}: ${f.error}`);
    }
  }
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
}
