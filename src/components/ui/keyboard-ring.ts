/**
 * Whether a menu or listbox shows the keyboard ring on its current item (UI audit 1: the brand ring, 3:1 on the
 * menu). `:focus-visible` alone misses a list opened with a click and then moved with the arrows, so the list keeps
 * this flag instead (visual-1 review): a key turns it on (not a modifier held alone, which moves nothing), the pointer
 * moving or pressing turns it off.
 */
export type RingInput = { kind: "key"; key: string } | { kind: "pointer" };

const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);

export function keyboardRing(before: boolean, input: RingInput): boolean {
  if (input.kind === "pointer") return false;
  return MODIFIERS.has(input.key) ? before : true;
}

const PRESS_KEYS = new Set(["Enter", " ", "ArrowDown", "ArrowUp"]);

/**
 * Whether a menu or select trigger's next click comes from the keyboard: the last thing on it was a key that presses or
 * opens it (Enter, Space, ↑, ↓), not a pointerdown (mouse, pen or touch). The click itself cannot tell: a tap's click
 * in iOS Safari has `detail` 0 like the keyboard's (visual-1 review 2), and a phone shows no ring for the pointer.
 */
export function pressedByKey(before: boolean, input: RingInput): boolean {
  if (input.kind === "pointer") return false;
  return PRESS_KEYS.has(input.key) ? true : before;
}
