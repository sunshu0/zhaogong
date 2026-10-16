// When dragging a bottom sheet's handle down closes it (Round 19). Pure, for the sheet and its test.

/** Dragged at least this far down, the sheet closes when let go. */
export const DISMISS_DISTANCE = 80;
/** A quick flick closes it from a shorter drag: this many px per ms. */
export const DISMISS_SPEED = 0.5;

/** `distance` in px (down is positive), `ms` from press to release. */
export function shouldDismiss(distance: number, ms: number): boolean {
  if (distance <= 0) return false;
  if (distance >= DISMISS_DISTANCE) return true;
  return distance >= 24 && ms > 0 && distance / ms >= DISMISS_SPEED;
}
