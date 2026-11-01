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

/**
 * A trigger's click came from the keyboard (Enter or Space on a button), not the pointer: a click the keyboard makes
 * has no pointer position, so `detail` is 0.
 */
export function clickFromKeyboard(event: { detail: number }): boolean {
  return event.detail === 0;
}
