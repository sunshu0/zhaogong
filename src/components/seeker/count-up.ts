// Timing for the landing page's count-up numbers. Pure functions so they can be unit-tested.

/** How long one number takes to count up. */
export const COUNT_UP_MS = 1400;

/** Each following number starts this much later (four numbers: at most 90 ms apart). */
export const STAGGER_MS = 30;

/** Fast first, slow at the end. */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** The whole number to show `elapsedMs` after the count-up started, for the number at position `index`. */
export function countAt(target: number, elapsedMs: number, index = 0): number {
  const t = (elapsedMs - index * STAGGER_MS) / COUNT_UP_MS;
  return Math.round(target * easeOutCubic(t));
}

/** When the last of `count` numbers reaches its value. */
export function totalCountUpMs(count: number): number {
  return COUNT_UP_MS + Math.max(0, count - 1) * STAGGER_MS;
}
