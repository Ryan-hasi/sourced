import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against source — no build step needed during development.
    alias: {
      "@sourcedhq/core": p("./packages/core/src/index.ts"),
      "@sourcedhq/log": p("./packages/log/src/index.ts"),
      "@sourcedhq/conformance": p("./packages/conformance/src/index.ts"),
      "@sourcedhq/mcp": p("./packages/mcp/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts"],
  },
});
