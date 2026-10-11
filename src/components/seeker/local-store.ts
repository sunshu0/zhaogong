"use client";

// A value kept in localStorage that components can subscribe to with useSyncExternalStore.
// Server rendering and hydration always see `parse(null)`, so the first client render matches the HTML.
import { useSyncExternalStore } from "react";
import type { StorageLike } from "@/components/seeker/session";

export interface LocalStore<T> {
  useValue(): T;
  /** Runs `change` against localStorage, then tells subscribers. */
  update<R>(change: (storage: StorageLike) => R): R | undefined;
}

export function createLocalStore<T>(key: string, parse: (raw: string | null) => T): LocalStore<T> {
  const listeners = new Set<() => void>();
  const empty = parse(null);
  let snapshot: { raw: string | null; value: T } | null = null;

  function read(): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function getSnapshot(): T {
    const raw = read();
    if (!snapshot || snapshot.raw !== raw) snapshot = { raw, value: parse(raw) };
    return snapshot.value;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    // Keeps other tabs in step.
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    useValue: () => useSyncExternalStore(subscribe, getSnapshot, () => empty),
    update(change) {
      let result;
      try {
        result = change(localStorage);
      } catch {
        // Storage can be unavailable (private mode, quota); the demo then simply does not remember.
      }
      for (const listener of listeners) listener();
      return result;
    },
  };
}

const noop = () => () => {};

/** False during server rendering and hydration, true after; lets components avoid flashing the wrong state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
