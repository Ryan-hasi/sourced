#!/usr/bin/env node
/**
 * sourced-anchor — verify a chain file and emit its head for public anchoring.
 *
 *   sourced-anchor <chain.jsonl> [--anchors <anchors.log>]
 *
 * Verifies the full chain. On success prints the head line; with --anchors it
 * also appends the head to an anchors file. Committing that file (or posting
 * the line anywhere public — a git commit, OpenTimestamps, a tweet) anchors
 * the ENTIRE verdict history up to this point: any later rewrite of any past
 * verdict breaks against the published head.
 *
 * Exit codes: 0 verified, 1 chain invalid, 2 usage error.
 */
import { appendFileSync } from "node:fs";
import { loadChain } from "./file.js";
import { verify } from "./index.js";

const args = process.argv.slice(2);
const chainPath = args[0];
if (!chainPath || chainPath.startsWith("--")) {
  console.error("usage: sourced-anchor <chain.jsonl> [--anchors <anchors.log>]");
  process.exit(2);
}
const anchorsIdx = args.indexOf("--anchors");
const anchorsPath = anchorsIdx >= 0 ? args[anchorsIdx + 1] : undefined;
if (anchorsIdx >= 0 && !anchorsPath) {
  console.error("--anchors requires a file path");
  process.exit(2);
}

const chain = loadChain(chainPath);
const res = verify(chain);
if (!res.ok) {
  console.error(`CHAIN INVALID at record ${res.badIndex}: ${res.reason}`);
  process.exit(1);
}
if (res.length === 0) {
  console.log("chain is empty — nothing to anchor");
  process.exit(0);
}

const line = `${new Date().toISOString()} seq=${res.length - 1} head=${res.head}`;
console.log(`VERIFIED ${res.length} records`);
console.log(line);
if (anchorsPath) {
  appendFileSync(anchorsPath, line + "\n", "utf8");
  console.log(`anchored → ${anchorsPath} (commit/publish this file)`);
}
