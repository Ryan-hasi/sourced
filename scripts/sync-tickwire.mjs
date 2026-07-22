/**
 * Refresh the Sourced core vendored into the Tickwire repo.
 *   node scripts/sync-tickwire.mjs
 * Copies packages/core/src/*.ts → NEWTicker/src/lib/sourced/
 * (log.ts/chain.ts over there are Tickwire-specific and stay hand-maintained).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = join(root, "..", "NEWTicker", "src", "lib", "sourced");

const files = ["index.ts", "independence.ts"];
for (const file of files) {
  const src = join(root, "packages/core/src", file);
  const dest = join(targetDir, file === "index.ts" ? "core.ts" : file);
  const banner =
    `// GENERATED from sourced repo packages/core/src/${file} — do not edit here.\n` +
    "// Refresh: node scripts/sync-tickwire.mjs (in the sourced repo).\n";
  const content = readFileSync(src, "utf8");
  const patched = file === "index.ts"
    ? content
    : content;
  writeFileSync(dest, banner + patched);
  console.log("synced", dest);
}
