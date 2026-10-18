import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Only Next's compiler can fill in next/root-params (Round 20, ADR 0023); tests get a stand-in.
      "next/root-params": fileURLToPath(new URL("./src/i18n/testing/root-params.ts", import.meta.url)),
    },
  },
  // Each test file gets its own in-memory database, migrated and loaded with the demo data on first use
  // (src/db/ready.ts): files run in separate module contexts.
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"], env: { DATABASE_URL: "file::memory:" } },
});
