// The database layer's tests again, on a local D1 database (Miniflare) instead of libSQL (ADR 0031): npm run test:d1.
// Only the files whose writes are rewritten for D1 so far; the rest still use interactive transactions, which D1 has
// not got, and join this list as they are rewritten. One file at a time: each starts a workerd process.
import { defineConfig } from "vitest/config";
import base from "./vitest.config.mts";

// Spread rather than mergeConfig, which would add these files to the base list instead of replacing it.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      "src/db/d1-writes.test.ts",
      "src/db/moderators.test.ts",
      "src/db/saved-jobs.test.ts",
      "src/db/resume-shares.test.ts",
      "src/db/personal-info-views.test.ts",
    ],
    setupFiles: ["src/db/testing/d1-setup.ts"],
    maxWorkers: 1,
  },
});
