// Optimistic writes (ADR 0031): read, decide in code, then write with "what I read is still so" in the statement's
// condition. When someone changed it in between, the write does nothing and we read and decide again.

/** What an attempt returns when its write found the rows changed since it read them. */
export const CHANGED = Symbol("changed");

export const ATTEMPTS = 3;

/** Runs `attempt` until it settles, at most 3 times; then `giveUp` answers (a "busy" result, or it throws). */
export async function untilSettled<T>(attempt: () => Promise<T | typeof CHANGED>, giveUp: () => T): Promise<T> {
  for (let i = 0; i < ATTEMPTS; i++) {
    const result = await attempt();
    if (result !== CHANGED) return result;
  }
  return giveUp();
}

/** The error when the rows kept changing under three attempts in a row where no "busy" result exists. */
export function keptChanging(what: string): never {
  throw new Error(`${what}: the rows kept changing under three attempts; nothing was written (ADR 0031).`);
}
