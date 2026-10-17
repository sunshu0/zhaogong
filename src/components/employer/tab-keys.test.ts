import { describe, expect, it } from "vitest";
import { nextTabIndex } from "./tab-keys";

describe("nextTabIndex", () => {
  it("moves with the arrows and wraps at both ends", () => {
    expect(nextTabIndex("ArrowRight", 0, 4)).toBe(1);
    expect(nextTabIndex("ArrowRight", 3, 4)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 2, 4)).toBe(1);
    expect(nextTabIndex("ArrowLeft", 0, 4)).toBe(3);
  });

  it("jumps with Home and End", () => {
    expect(nextTabIndex("Home", 2, 4)).toBe(0);
    expect(nextTabIndex("End", 0, 4)).toBe(3);
  });

  it("ignores other keys, and a row without tabs", () => {
    expect(nextTabIndex("ArrowDown", 1, 4)).toBeNull();
    expect(nextTabIndex("Enter", 1, 4)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });

  it("stays on the only tab of a row of one", () => {
    expect(nextTabIndex("ArrowRight", 0, 1)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 1)).toBe(0);
  });

  it("starts from the first or last tab when none is chosen", () => {
    expect(nextTabIndex("ArrowRight", -1, 4)).toBe(0);
    expect(nextTabIndex("ArrowLeft", -1, 4)).toBe(2);
  });
});
