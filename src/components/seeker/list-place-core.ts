// The rules of list-place.tsx (#409, ADR 0047) without the browser, so they can be tested.

/** What a list remembers when one of its links is pressed: the list (path and query), the link, where its item sat
 * from the top of the window, and the page's scroll. */
export type Place = { list: string; href: string; top: number; scrollY: number };

/** A stored place, or null when there is none or it is not one. */
export function parsePlace(stored: string | null): Place | null {
  try {
    const value: unknown = JSON.parse(stored ?? "null");
    if (!value || typeof value !== "object") return null;
    const { list, href, top, scrollY } = value as Record<string, unknown>;
    return typeof list === "string" &&
      typeof href === "string" &&
      typeof top === "number" &&
      typeof scrollY === "number" &&
      list.startsWith("/") &&
      href.startsWith("/")
      ? { list, href, top, scrollY }
      : null;
  } catch {
    return null;
  }
}

/**
 * The list to go back to from the page at `pathname`: the one it was opened from, when that list is at `listPath`
 * (with any query). Otherwise null, and the back link opens its list at the top.
 */
export function returnList(place: Place | null, pathname: string, listPath: string): string | null {
  if (!place || place.href !== pathname) return null;
  return place.list.split(/[?#]/)[0] === listPath ? place.list : null;
}

/** The item is gone (the job closed): the old scroll position, kept inside the page as it is now. */
export function fallbackScroll(scrollY: number, pageHeight: number, windowHeight: number) {
  return Math.max(0, Math.min(scrollY, pageHeight - windowHeight));
}
