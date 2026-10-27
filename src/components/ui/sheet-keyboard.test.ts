import { describe, expect, it } from "vitest";
import { KEYBOARD_MIN_INSET, keyboardRoom } from "./sheet-keyboard";

describe("keyboardRoom", () => {
  it("is null while the visible window is the whole page", () => {
    expect(keyboardRoom(812, { height: 812, offsetTop: 0, scale: 1 })).toBeNull();
  });

  it("lifts the sheet by what the keyboard covers and fits it in what is left", () => {
    expect(keyboardRoom(812, { height: 476, offsetTop: 0, scale: 1 })).toEqual({ inset: 336, height: 476 });
  });

  it("counts a visible window scrolled down the page (Safari keeps the field in view)", () => {
    expect(keyboardRoom(812, { height: 476, offsetTop: 120, scale: 1 })).toEqual({ inset: 216, height: 476 });
  });

  it("leaves a browser bar settling alone", () => {
    expect(keyboardRoom(812, { height: 812 - KEYBOARD_MIN_INSET + 1, offsetTop: 0, scale: 1 })).toBeNull();
    expect(keyboardRoom(812, { height: 812 - KEYBOARD_MIN_INSET, offsetTop: 0, scale: 1 })).toEqual({
      inset: KEYBOARD_MIN_INSET,
      height: 812 - KEYBOARD_MIN_INSET,
    });
  });

  it("is null under a pinch zoom, which shortens the visible window too", () => {
    expect(keyboardRoom(812, { height: 406, offsetTop: 0, scale: 2 })).toBeNull();
  });
});
