import { describe, expect, it } from "vitest";
import { listboxKey, shownLabel, typeAhead } from "./select-keys";

describe("Select's option list keys (Round 19)", () => {
  it("moves with the arrows without wrapping, and jumps with Home and End", () => {
    expect(listboxKey("ArrowDown", 0, 3)).toEqual({ move: 1 });
    expect(listboxKey("ArrowDown", 2, 3)).toEqual({ move: 2 });
    expect(listboxKey("ArrowUp", 0, 3)).toEqual({ move: 0 });
    expect(listboxKey("ArrowUp", 2, 3)).toEqual({ move: 1 });
    expect(listboxKey("Home", 2, 3)).toEqual({ move: 0 });
    expect(listboxKey("End", 0, 3)).toEqual({ move: 2 });
  });

  it("picks with Enter or Space, closes with Esc or Tab, ignores the rest", () => {
    expect(listboxKey("Enter", 1, 3)).toEqual({ pick: 1 });
    expect(listboxKey(" ", 0, 3)).toEqual({ pick: 0 });
    expect(listboxKey("Enter", -1, 3)).toBeNull();
    expect(listboxKey("Escape", 1, 3)).toEqual({ close: true });
    expect(listboxKey("Tab", 1, 3)).toEqual({ close: true });
    expect(listboxKey("a", 1, 3)).toBeNull();
    expect(listboxKey("Escape", -1, 0)).toEqual({ close: true });
    expect(listboxKey("ArrowDown", -1, 0)).toBeNull();
  });

  it("jumps to the next option starting with a typed letter, wrapping round", () => {
    const labels = ["Auckland", "Wellington", "Christchurch", "Whanganui"];
    expect(typeAhead(labels, "w", 0)).toBe(1);
    expect(typeAhead(labels, "W", 1)).toBe(3);
    expect(typeAhead(labels, "w", 3)).toBe(1);
    expect(typeAhead(labels, "x", 0)).toBe(-1);
    expect(typeAhead(labels, " ", 0)).toBe(-1);
    expect(typeAhead(labels, "Shift", 0)).toBe(-1);
  });

  it("shows the chosen option, or the placeholder", () => {
    const options = [
      { value: "software", label: "软件" },
      { value: "electrical", label: "电子电气" },
    ];
    expect(shownLabel(options, "electrical", "不限")).toBe("电子电气");
    expect(shownLabel(options, "", "不限")).toBe("不限");
    expect(shownLabel(options, "gone", "不限")).toBe("不限");
  });
});
