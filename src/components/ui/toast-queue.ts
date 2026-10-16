// The queue behind Toast (Round 19). Pure, for the component and its test: a new toast goes to the end, the same
// words again replace the earlier one (pressing 收藏 twice shows one toast), and at most MAX_TOASTS show at once.

export type ToastItem = { id: number; text: string; until: number };

export const MAX_TOASTS = 3;
/** How long a toast stays, in ms. */
export const TOAST_MS = 3000;

export function addToast(queue: ToastItem[], text: string, id: number, now: number, ms = TOAST_MS): ToastItem[] {
  return [...queue.filter((item) => item.text !== text), { id, text, until: now + ms }].slice(-MAX_TOASTS);
}

/** The toasts still showing at `now`. */
export function liveToasts(queue: ToastItem[], now: number): ToastItem[] {
  return queue.filter((item) => item.until > now);
}

/** When the next toast goes, or null when none show. */
export function nextExpiry(queue: ToastItem[]): number | null {
  return queue.length ? Math.min(...queue.map((item) => item.until)) : null;
}
