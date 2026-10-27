// How far a bottom sheet moves up for the phone's keyboard (#413). Pure, for the hook and its test.

/** Below this many px the gap under the visible window is a browser bar settling, not a keyboard. */
export const KEYBOARD_MIN_INSET = 80;

/**
 * Where the browser does not shrink the page for the keyboard (Safari; Chrome without
 * `interactive-widget=resizes-content`), only the visible window (visualViewport) gets shorter and the keyboard
 * covers the bottom of the page, and of a sheet stuck to it. Returns how far the sheet must sit above the bottom and
 * how tall it may be, or null when nothing is covered: no keyboard, or a pinch zoom (which also shortens the window).
 */
export function keyboardRoom(
  pageHeight: number,
  visible: { height: number; offsetTop: number; scale: number },
): { inset: number; height: number } | null {
  if (Math.abs(visible.scale - 1) > 0.01) return null;
  const inset = Math.round(pageHeight - visible.height - visible.offsetTop);
  if (inset < KEYBOARD_MIN_INSET) return null;
  return { inset, height: Math.round(visible.height) };
}
