// Browser tests. Run with `npm run test:e2e`; not part of `npm run check`. Uses the server on E2E_PORT (default 8702,
// line A's; each clone has its own port), starting one if none is running. With E2E_SERVER=start that is the browser
// tests' build (`npm run e2e:build` first; #139), which needs a fraction of next dev's memory: the full run uses it.
// Otherwise next dev. Specs must not depend on how many jobs exist, since others publish.
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT) || 8702;
const ON_TEST_BUILD = process.env.E2E_SERVER === "start";

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
    command: ON_TEST_BUILD
      ? `node scripts/e2e-server.mjs start ${PORT}`
      : `node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
