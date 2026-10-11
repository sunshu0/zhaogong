"use client";

import { createLocalStore } from "@/components/seeker/local-store";
import { clearSession, parseSession, SESSION_KEY, writeSession, type DemoSession } from "@/components/seeker/session";

export { useHydrated } from "@/components/seeker/local-store";

const store = createLocalStore(SESSION_KEY, parseSession);

/** The signed-in demo user, or null. Always null during server rendering and hydration. */
export function useSession(): DemoSession | null {
  return store.useValue();
}

export function signIn(email: string): DemoSession | undefined {
  return store.update((storage) => writeSession(storage, email));
}

export function signOut(): void {
  store.update(clearSession);
}
