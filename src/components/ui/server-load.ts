// A page's Server Function loads when no answer comes (#246): no network, or the server restarting. Without this the
// page waits on its skeleton for good; instead the place of the list says so and offers to ask again (as /admin, #183).
// Shared by the employer and the seeker pages; /admin keeps its own (load-state.ts), which also knows refusals.

/** What a load got, for which `key` (whose data, which job) and which `version` (how many reloads) it was asked. */
export type Got<T> = { key: string; version: number } & ({ value: T } | { failed: true });

/** What to show now: `value` once it came, `failed` when the last ask got no answer. */
export type Shown<T> = { value: T | undefined; failed: boolean };

/**
 * What a load shows for `key` at `version`. An answer stays while the next one is on its way (a list keeps its
 * place after a change); nothing shows for another key (another account, another job). A failed ask shows `failed`
 * only for its own version, so pressing 重试 brings the skeleton back while the new ask is on its way.
 */
export function shownLoad<T>(got: Got<T> | undefined, key: string | undefined, version: number): Shown<T> {
  if (!got || key === undefined || got.key !== key) return { value: undefined, failed: false };
  if ("failed" in got) return { value: undefined, failed: got.version === version };
  return { value: got.value, failed: false };
}
