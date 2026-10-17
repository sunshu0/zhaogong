// The browser tests' build (#139): the full e2e runs on `next build` + `next start` with ZG_E2E=1 instead of on
// `next dev`, which grew past 3 GB in a run. That build keeps the development helpers the tests use: the sign-in
// code on the page, the /api/dev routes and the rule-based posting script. The switch is fixed when the app is
// built (next.config.ts writes it into the code), so a deployment built without it cannot be turned on by setting a
// variable later, and no deployment configuration sets it (test-build.test.ts checks). Server only.

/** Development and tests, or a production build made with ZG_E2E=1. Pure, for the tests. */
export function devHelpersOn(nodeEnv: string | undefined, testBuild: string | undefined): boolean {
  return nodeEnv !== "production" || testBuild === "1";
}

/**
 * Whether the development helpers are on in this server. `process.env.ZG_E2E` is spelled out here, not read from an
 * object, so the build replaces it with the value next.config.ts fixed.
 */
export function devHelpersEnabled(): boolean {
  return devHelpersOn(process.env.NODE_ENV, process.env.ZG_E2E);
}

/** The browser tests' build: true only in a build made with ZG_E2E=1. */
export function isTestBuild(): boolean {
  return process.env.ZG_E2E === "1";
}
