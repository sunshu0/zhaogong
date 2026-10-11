"use client";
// Employer demo sign-in, kept in localStorage. A stand-in until line A's demo sign-in (A4) lands;
// then the email part comes from there and only the employer link stays here.
import { useMemo, useSyncExternalStore } from "react";

export interface EmployerSession {
  email: string;
  /** Which demo business this account posts for. */
  employerId: string;
}

const KEY = "zhaogong:employer-session";
const listeners = new Set<() => void>();

export function parseSession(raw: string | null | undefined): EmployerSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value == null) return null;
    const { email, employerId } = value as Record<string, unknown>;
    return typeof email === "string" && typeof employerId === "string" ? { email, employerId } : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `undefined` until the browser has been read (server render and hydration), then the session or null. */
export function useEmployerSession(): EmployerSession | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => localStorage.getItem(KEY),
    () => undefined,
  );
  return useMemo(() => (raw === undefined ? undefined : parseSession(raw)), [raw]);
}

export function signInEmployer(session: EmployerSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
  listeners.forEach((l) => l());
}

export function signOutEmployer() {
  localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
