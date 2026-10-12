"use client";
import { useEffect, useRef } from "react";

/**
 * When `key` changes (a new step, a saved state), moves focus to the element the returned ref is on,
 * usually the new heading with tabIndex={-1}, so keyboard and screen-reader users land on the new
 * content instead of the top of the page. Compares with the last key, so it never fires on first
 * render, also under React's development double effects.
 */
export function useFocusOnChange<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  const last = useRef(key);
  useEffect(() => {
    if (Object.is(last.current, key)) return;
    last.current = key;
    ref.current?.focus();
  }, [key]);
  return ref;
}
