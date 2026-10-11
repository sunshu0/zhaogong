"use client";

import { useSyncExternalStore } from "react";
import { clearSession, parseSession, SESSION_KEY, writeSession, type DemoSession } from "@/components/seeker/session";

const listeners = new Set<() => void>();
let snapshot: { raw: string | null; session: DemoSession | null } = { raw: null, session: null };

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keeps other tabs in step when the user signs in or out there.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): DemoSession | null {
  const raw = readRaw();
  if (raw !== snapshot.raw) snapshot = { raw, session: parseSession(raw) };
  return snapshot.session;
}

/** The signed-in demo user, or null. Always null during server rendering and hydration. */
export function useSession(): DemoSession | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

const noop = () => () => {};

/** False during server rendering and hydration, true after; lets components avoid flashing the signed-out state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function signIn(email: string): DemoSession {
  const session = writeSession(localStorage, email);
  emit();
  return session;
}

export function signOut(): void {
  clearSession(localStorage);
  emit();
}
