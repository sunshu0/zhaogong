import { describe, expect, it } from "vitest";
import { FAILED, isFailed, ready, settle, shown } from "@/app/admin/load-state";

describe("admin calls that get no answer (#183)", () => {
  it("settle gives the answer, or null when the call throws", async () => {
    expect(await settle(async () => ({ ok: true }))).toEqual({ ok: true });
    expect(await settle(() => Promise.reject(new TypeError("Failed to fetch")))).toBeNull();
    expect(
      await settle(async () => {
        throw new Error("server restarting");
      }),
    ).toBeNull();
  });

  it("keeps the last answer while the next is on its way, but a failure being tried again is loading", () => {
    expect(shown(undefined, 0)).toBeUndefined();
    expect(shown({ version: 0, value: ["a"] }, 0)).toEqual(["a"]);
    // After a decision: version 1 asked, version 0's list still shows.
    expect(shown({ version: 0, value: ["a"] }, 1)).toEqual(["a"]);
    expect(shown({ version: 1, value: FAILED }, 1)).toBe(FAILED);
    // 重试 asked again (version 2): loading, not the old failure.
    expect(shown({ version: 1, value: FAILED }, 2)).toBeUndefined();
  });

  it("ready is the answer itself, not a refusal, a failure or nothing yet", () => {
    const queue = { flagged: [] };
    expect(ready(queue)).toBe(queue);
    expect(ready([])).toEqual([]);
    expect(ready({ refused: "not_moderator", error_zh: "只有审核员能打开审核后台" })).toBeUndefined();
    expect(ready(FAILED)).toBeUndefined();
    expect(ready(undefined)).toBeUndefined();
    expect(isFailed(FAILED)).toBe(true);
    expect(isFailed({ failed: true })).toBe(false); // only the one marker
  });
});
