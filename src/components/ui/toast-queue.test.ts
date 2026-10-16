import { describe, expect, it } from "vitest";
import { addToast, liveToasts, MAX_TOASTS, nextExpiry, TOAST_MS } from "./toast-queue";

describe("the toast queue (Round 19)", () => {
  it("adds to the end, each for TOAST_MS", () => {
    const q = addToast(addToast([], "已收藏", 1, 0), "已保存", 2, 100);
    expect(q).toEqual([
      { id: 1, text: "已收藏", until: TOAST_MS },
      { id: 2, text: "已保存", until: 100 + TOAST_MS },
    ]);
  });

  it("replaces the same words instead of stacking them", () => {
    const q = addToast(addToast(addToast([], "已收藏", 1, 0), "已保存", 2, 10), "已收藏", 3, 20);
    expect(q.map((item) => [item.id, item.text])).toEqual([
      [2, "已保存"],
      [3, "已收藏"],
    ]);
  });

  it(`keeps at most ${MAX_TOASTS}, dropping the oldest`, () => {
    let q = addToast([], "一", 1, 0);
    for (const [i, text] of ["二", "三", "四"].entries()) q = addToast(q, text, i + 2, 0);
    expect(q.map((item) => item.text)).toEqual(["二", "三", "四"]);
  });

  it("lets toasts go when their time is up, and says when the next one goes", () => {
    const q = addToast(addToast([], "已收藏", 1, 0, 1000), "已保存", 2, 0, 2000);
    expect(nextExpiry(q)).toBe(1000);
    expect(liveToasts(q, 1000).map((item) => item.text)).toEqual(["已保存"]);
    expect(liveToasts(q, 2000)).toEqual([]);
    expect(nextExpiry([])).toBeNull();
  });
});
