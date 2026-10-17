/**
 * Which tab is chosen after a key press in a row of `count` tabs with `current` chosen (WAI-ARIA tabs pattern, #172):
 * the arrows move and wrap, Home and End jump. Returns null for keys the tabs ignore.
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: count - 1 }[key];
  return next == null ? null : ((next % count) + count) % count;
}
