// The browser tests' server (#139): a production build made with ZG_E2E=1, in .next-e2e, instead of `next dev`.
//   npm run e2e:build          builds it (again after every code change)
//   npm run e2e:start -- 8702  starts it on the clone's port; stop it after the run
// ZG_E2E=1 keeps the development helpers the tests use (src/lib/test-build.ts). Build and start also set what
// .env.development sets for `next dev` (ADMIN_ENABLED, the demo admin, the demo data); the start adds a sign-in secret for this
// machine only.
// Never use this build for anything but tests.
import { spawn } from "node:child_process";
import path from "node:path";

const [mode, port = process.env.E2E_PORT || "8702"] = process.argv.slice(2);
if (mode !== "build" && mode !== "start") {
  console.error("usage: node scripts/e2e-server.mjs build | start [port]");
  process.exit(1);
}

const env = {
  ...process.env,
  ZG_E2E: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  // Both: /admin is a static page, so the build reads ADMIN_ENABLED too (without it /admin is a 404); and the build
  // prerenders the home page's no-JavaScript block from data/zhaogong.db, which an empty database after
  // `npm run db:reset` only fills with the demo data when DEMO_DATA asks for it (#144).
  ADMIN_ENABLED: "1",
  DEMO_DATA: "true",
  // The demo admin (ADR 0043), as .env.development has it: the tests add and remove moderators as this account.
  ZHAOGONG_ADMIN_EMAILS: "admin@example.com",
  ...(mode === "start" && {
    AUTH_SECRET: process.env.AUTH_SECRET || "zhaogong-browser-tests-only",
  }),
};
const args = mode === "build" ? ["build"] : ["start", "-p", port];
const child = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), ...args], {
  env,
  stdio: "inherit",
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
