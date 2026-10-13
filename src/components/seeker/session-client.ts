"use client";

import { createLocalStore } from "@/components/seeker/local-store";
import { claimGuestActivity } from "@/components/seeker/identity-activity";
import { syncSessionIdentity } from "@/components/seeker/identity";
import {
  clearSession,
  parseSession,
  SESSION_KEY,
  updateIdentity,
  writeSession,
  type DemoSession,
  type SessionIdentity,
} from "@/components/seeker/session";

export { useHydrated } from "@/components/seeker/local-store";

const store = createLocalStore(SESSION_KEY, parseSession);

/** The signed-in demo user, or null. Always null during server rendering and hydration. */
export function useSession(): DemoSession | null {
  return store.useValue();
}

/** Starts a session with the identity the server confirmed (see src/app/login/actions.ts). */
export function startSession(email: string, identity: SessionIdentity): DemoSession | undefined {
  return store.update((storage) => {
    const session = writeSession(storage, email, new Date(), identity);
    claimGuestActivity(storage, session);
    return session;
  });
}

/** Switches or corrects the identity of the signed-in session. */
export function setIdentity(identity: SessionIdentity): DemoSession | null | undefined {
  return store.update((storage) => updateIdentity(storage, identity));
}

/** A delayed server lookup must respect identity changes made while the request was in flight. */
export function syncAccountIdentity(
  requested: DemoSession,
  status: Parameters<typeof syncSessionIdentity>[2],
): DemoSession | null | undefined {
  return store.update((storage) => syncSessionIdentity(storage, requested, status));
}

export function signOut(): void {
  store.update(clearSession);
}
