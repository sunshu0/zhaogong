// The database layer's tests again, on a local D1 database (Miniflare) instead of libSQL (ADR 0031): npm run test:d1.
// Portable database operations all run here. One file at a time: each starts a workerd process.
import { defineConfig } from "vitest/config";
import base from "./vitest.config.mts";

// Spread rather than mergeConfig, which would add these files to the base list instead of replacing it.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["src/db/**/*.test.ts", "src/lib/data.test.ts"],
    // These check the Node/libSQL migrator and driver selection itself, not portable database operations.
    exclude: ["src/db/migrations.test.ts", "src/db/d1-migrations.test.ts", "src/db/d1-rules.test.ts"],
    setupFiles: ["src/db/testing/d1-setup.ts"],
    maxWorkers: 1,
  },
});
