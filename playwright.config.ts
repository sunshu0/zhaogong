// Browser tests for the job seekers' pages (line A). Run with `npm run test:e2e`; not part of `npm run check`.
// Uses line A's dev server on port 8702, starting one if none is running.
import { defineConfig } from "@playwright/test";

const PORT = 8702;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    locale: "zh-CN",
    timezoneId: "Pacific/Auckland",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
