// The admin pages' Server Function calls when no answer comes (#183): no network, or the server restarting. A call
// that throws inside a transition would hand the error to the page's error boundary and the whole of /admin would
// give way, with whatever the moderator had typed; instead the card or the list says so and offers to try again.
import type { Refused } from "@/app/[lang]/admin/actions";

/** A load that got no answer. */
export type Failed = { failed: true };
export const FAILED: Failed = { failed: true };

export const isFailed = (x: unknown): x is Failed => x === FAILED;

/** A Server Function call that never throws: an answer that never came is `null`. */
export async function settle<T>(call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

/** What a load gave, and for which `version` of the page it was asked. */
export type Loaded<T> = { version: number; value: T | Failed };

/**
 * What to show for a load now: the last answer, kept while the next one is on its way (after a decision the list stays
 * until it is fresh); undefined while the first is on its way, and also while a failed one is tried again.
 */
export function shown<T>(loaded: Loaded<T> | undefined, version: number): T | Failed | undefined {
  if (!loaded) return undefined;
  if (isFailed(loaded.value) && loaded.version !== version) return undefined;
  return loaded.value;
}

/** The answer itself; undefined while it is on its way, when it was refused or when none came. */
export function ready<T extends object>(x: T | Refused | Failed | undefined): T | undefined {
  return x && !isFailed(x) && !("refused" in x) ? x : undefined;
}
