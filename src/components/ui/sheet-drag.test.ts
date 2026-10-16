import { describe, expect, it } from "vitest";
import { DISMISS_DISTANCE, shouldDismiss } from "./sheet-drag";

describe("dragging a bottom sheet down (Round 19)", () => {
  it("closes it once dragged far enough, however slowly", () => {
    expect(shouldDismiss(DISMISS_DISTANCE, 2000)).toBe(true);
    expect(shouldDismiss(DISMISS_DISTANCE - 1, 2000)).toBe(false);
  });

  it("closes it on a quick flick, but not on a tiny one or an upward drag", () => {
    expect(shouldDismiss(40, 50)).toBe(true);
    expect(shouldDismiss(20, 10)).toBe(false);
    expect(shouldDismiss(-100, 50)).toBe(false);
    expect(shouldDismiss(0, 0)).toBe(false);
  });
});
