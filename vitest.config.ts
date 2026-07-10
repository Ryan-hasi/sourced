import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against source — no build step needed during development.
    alias: {
      "@sourced/core": p("./packages/core/src/index.ts"),
      "@sourced/log": p("./packages/log/src/index.ts"),
      "@sourced/conformance": p("./packages/conformance/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts"],
  },
});
