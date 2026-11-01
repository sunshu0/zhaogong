import { describe, expect, it } from "vitest";
import { clickFromKeyboard, keyboardRing } from "./keyboard-ring";

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

describe("clickFromKeyboard", () => {
  it("tells a keyboard click (detail 0) from a pointer one", () => {
    expect(clickFromKeyboard({ detail: 0 })).toBe(true);
    expect(clickFromKeyboard({ detail: 1 })).toBe(false);
  });
});
