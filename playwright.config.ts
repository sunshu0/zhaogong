// Browser tests for the job seekers' pages (line A). Run with `npm run test:e2e`; not part of `npm run check`.
// Uses a dev server on E2E_PORT (default 8702, line A's), starting one if none is running;
// line B runs its own specs with E2E_PORT=8703. Specs must not depend on how many jobs exist, since others publish.
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT) || 8702;

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
    // Signs in the demo moderator once (#50): a code can be asked for once a minute per email, so specs that need
    // /admin share this session (e2e/.auth/moderator.json, see moderatorPage in e2e/employer/helpers.ts).
    { name: "moderator-session", testMatch: /moderator\.setup\.ts/ },
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      dependencies: ["moderator-session"],
    },
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 800 } },
      dependencies: ["moderator-session"],
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
