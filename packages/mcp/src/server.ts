#!/usr/bin/env node
/**
 * sourced-mcp — stdio entry point. MCP stdio transport: newline-delimited
 * JSON-RPC 2.0 on stdin/stdout. All logging goes to stderr (stdout is the
 * protocol channel).
 */
import { createInterface } from "node:readline";
import { handle } from "./index.js";

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }) + "\n");
    return;
  }
  const res = await handle(msg);
  if (res) process.stdout.write(JSON.stringify(res) + "\n");
});

process.stderr.write("sourced mcp server ready (stdio)\n");
