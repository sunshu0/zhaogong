// #202: a button whose action is on its way stays focusable. A focused button that turns `disabled` drops the focus
// to the page in Chromium, so a keyboard user is sent back to the top after each press (#179's 收藏). Keep
// `disabled` for "cannot be pressed yet" (a form not filled in); for "on its way" spread busyProps(busy) instead.
import type { MouseEvent } from "react";

export interface BusyProps {
  "aria-disabled"?: true;
  "aria-busy"?: true;
  onClickCapture?: (event: MouseEvent<HTMLElement>) => void;
}

/** Stops a press before the button's own onClick runs, and keeps a submit button from sending its form. */
export function holdClick(event: Pick<MouseEvent<HTMLElement>, "preventDefault" | "stopPropagation">): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Spread on a button (after its own props) while its action is on its way: aria-disabled and aria-busy, and every
 * press held back, by mouse, Enter, Space or a form's Enter key. The button keeps the focus. Style the busy look with
 * the `aria-disabled:` variant (buttonClass already has it); nothing when not busy.
 */
export function busyProps(busy: boolean): BusyProps {
  return busy ? { "aria-disabled": true, "aria-busy": true, onClickCapture: holdClick } : {};
}
