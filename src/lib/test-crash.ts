// Browser tests only (#178): lets an e2e make one part of a page fail while it renders, to check that the part's
// error boundary keeps what the user has typed. The part named in localStorage "zg-e2e-crash" throws. Only in the
// browser tests' build: ZG_E2E is written into the code at build time (next.config.ts), so elsewhere this is a no-op.

export const TEST_CRASH_KEY = "zg-e2e-crash";

/** Throws while rendering `part` when the browser tests asked for it; does nothing outside the tests' build. */
export function crashForTests(part: string) {
  if (process.env.ZG_E2E !== "1" || typeof window === "undefined") return;
  if (window.localStorage.getItem(TEST_CRASH_KEY) === part)
    throw new Error(`Test crash in ${part} (${TEST_CRASH_KEY})`);
}
