"use client";
import { useCallback, useEffect, useRef } from "react";

const CONTROLS = "input, textarea, select, button";
const FOCUSABLE = "input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)";

/** The element itself when it takes focus, else the first control inside it that does. */
function firstFocusable(box: HTMLElement | null): HTMLElement | null {
  if (!box) return null;
  return box.matches(FOCUSABLE) ? box : box.querySelector<HTMLElement>(FOCUSABLE);
}

/** The controls inside `box`, enabled or not, in document order: the same row of buttons gives the same list. */
function controls(box: HTMLElement): HTMLElement[] {
  return Array.from(box.querySelectorAll<HTMLElement>(CONTROLS));
}

/**
 * A confirming form that takes the place of the buttons that opened it (#189). The pressed button goes away, and with
 * it the focus, so keyboard users would start again from the top of the page: when `open` turns true, focus moves to
 * the form's first control; when it turns false (取消, or done), back to the button in `opener` that last had the
 * focus — 不显示 next to 通过, say, not the row's first button — or the first one that takes it. Never on the first
 * render. `opener` is a callback ref, so it follows the row each time it is drawn again.
 */
export function useSwapFocus<O extends HTMLElement = HTMLDivElement, F extends HTMLElement = HTMLFieldSetElement>(
  open: boolean,
) {
  const openerBox = useRef<O | null>(null);
  const form = useRef<F>(null);
  const last = useRef(open);
  const pressed = useRef(-1); // the place in the opener row of the control that last had the focus

  const opener = useCallback((box: O | null) => {
    openerBox.current = box;
    if (!box) return;
    const remember = (event: FocusEvent) => {
      pressed.current = controls(box).indexOf(event.target as HTMLElement);
    };
    box.addEventListener("focusin", remember);
    return () => box.removeEventListener("focusin", remember);
  }, []);

  useEffect(() => {
    if (last.current === open) return;
    last.current = open;
    if (open) {
      firstFocusable(form.current)?.focus();
      return;
    }
    const box = openerBox.current;
    if (!box) return;
    const back = controls(box)[pressed.current];
    (back?.matches(FOCUSABLE) ? back : firstFocusable(box))?.focus();
  }, [open]);

  return { opener, form };
}
