import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // DB-backed suites share the local Postgres; keep them serial to avoid
    // cross-test truncation races.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
