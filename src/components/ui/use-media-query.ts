"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, following it as the window changes. The server, and the first render in the
 * browser, assume `serverValue`, so pick what the page should look like before JavaScript runs.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
