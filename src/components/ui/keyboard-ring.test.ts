import { describe, expect, it } from "vitest";
import { keyboardRing, pressedByKey } from "./keyboard-ring";

describe("keyboardRing", () => {
  it("comes on with a key, also after the list was opened with a click", () => {
    expect(keyboardRing(false, { kind: "key", key: "ArrowDown" })).toBe(true);
    expect(keyboardRing(false, { kind: "key", key: "End" })).toBe(true);
    expect(keyboardRing(false, { kind: "key", key: "点" })).toBe(true);
    expect(keyboardRing(true, { kind: "key", key: "ArrowUp" })).toBe(true);
  });

  it("goes off when the pointer moves or presses", () => {
    expect(keyboardRing(true, { kind: "pointer" })).toBe(false);
    expect(keyboardRing(false, { kind: "pointer" })).toBe(false);
  });

  it("does not change for a modifier held alone", () => {
    expect(keyboardRing(false, { kind: "key", key: "Shift" })).toBe(false);
    expect(keyboardRing(true, { kind: "key", key: "Control" })).toBe(true);
  });
});

describe("pressedByKey", () => {
  it("is the keyboard after Enter, Space, ↑ or ↓ on the trigger", () => {
    for (const key of ["Enter", " ", "ArrowDown", "ArrowUp"])
      expect(pressedByKey(false, { kind: "key", key })).toBe(true);
  });

  it("is the pointer after a pointerdown, also a touch whose click looks like the keyboard's (detail 0)", () => {
    expect(pressedByKey(true, { kind: "pointer" })).toBe(false);
    // Tab onto it, then a tap: the tap decides.
    expect(pressedByKey(pressedByKey(false, { kind: "key", key: "Enter" }), { kind: "pointer" })).toBe(false);
  });

  it("does not change for other keys", () => {
    expect(pressedByKey(false, { kind: "key", key: "Tab" })).toBe(false);
    expect(pressedByKey(false, { kind: "key", key: "Shift" })).toBe(false);
    expect(pressedByKey(true, { kind: "key", key: "a" })).toBe(true);
  });
});
