import { describe, expect, it } from "vitest";
import { nextMenuIndex } from "./menu-keys";

describe("nextMenuIndex", () => {
  it("moves down and up, wrapping at the ends", () => {
    expect(nextMenuIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextMenuIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextMenuIndex("ArrowUp", 0, 3)).toBe(2);
    expect(nextMenuIndex("ArrowUp", 2, 3)).toBe(1);
  });

  it("jumps with Home and End", () => {
    expect(nextMenuIndex("Home", 2, 4)).toBe(0);
    expect(nextMenuIndex("End", 0, 4)).toBe(3);
  });

  it("ignores other keys and empty menus", () => {
    expect(nextMenuIndex("a", 0, 3)).toBeNull();
    expect(nextMenuIndex("ArrowDown", 0, 0)).toBeNull();
  });
});
