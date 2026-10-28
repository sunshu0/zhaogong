// #418 uses a dedicated production test build and owns its server for the whole run.
import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const portText = process.env.E2E_PORT || "8705";
if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
  throw new Error("E2E_PORT must be an integer from 1 to 65535.");
}
if (process.env.E2E_SERVER && process.env.E2E_SERVER !== "start") {
  throw new Error("INP only measures the production e2e build; E2E_SERVER must be start.");
}
if (!existsSync(".next-e2e/BUILD_ID")) {
  throw new Error("INP needs a production e2e build. Run npm run e2e:build first, under the resource rules.");
}
process.env.E2E_SERVER = "start";
const PORT = Number(portText);

export default defineConfig({
  testDir: "perf",
  testMatch: /inp\.spec\.ts/,
  outputDir: "test-results/inp",
  timeout: 10 * 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    locale: "zh-CN",
    timezoneId: "Pacific/Auckland",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `node scripts/e2e-server.mjs start ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { NEXT_TELEMETRY_DISABLED: "1", E2E_SERVER: "start" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
