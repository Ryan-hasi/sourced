/**
 * Refresh the Sourced core vendored into the Tickwire repo.
 *   node scripts/sync-tickwire.mjs
 * Copies packages/core/src/index.ts → NEWTicker/src/lib/sourced/core.ts
 * (log.ts/chain.ts over there are Tickwire-specific and stay hand-maintained).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "..", "NEWTicker", "src", "lib", "sourced", "core.ts");

const banner =
  "// GENERATED from sourced repo packages/core/src/index.ts — do not edit here.\n" +
  "// Refresh: node scripts/sync-tickwire.mjs (in the sourced repo).\n";
writeFileSync(target, banner + readFileSync(join(root, "packages/core/src/index.ts"), "utf8"));
console.log("synced", target);
