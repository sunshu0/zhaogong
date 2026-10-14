/**
 * Which menu item gets focus after a key press, for a menu of `count` items with `current` focused
 * (WAI-ARIA menu button pattern). Arrows wrap; Home and End jump. Returns null for keys the menu ignores.
 */
export function nextMenuIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
