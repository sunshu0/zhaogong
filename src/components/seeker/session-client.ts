"use client";

// The browser's copy of the session, for display only. The real session is the httpOnly cookie on the server
// (src/lib/auth, A12-1); every Server Function reads that. The copy is filled from the server's answers and
// corrected once per page load (syncWithServer), so editing localStorage signs nobody in.
import { accountStatus, signOutAccount, switchIdentity, type AccountStatus } from "@/app/login/actions";
import { createLocalStore } from "@/components/seeker/local-store";
import { claimGuestActivity } from "@/components/seeker/identity-activity";
import { applyServerSession, syncSessionIdentity } from "@/components/seeker/identity";
import {
  clearSession,
  parseSession,
  readSession,
  SESSION_KEY,
  updateIdentity,
  writeSession,
  type DemoSession,
  type SessionIdentity,
} from "@/components/seeker/session";

export { useHydrated } from "@/components/seeker/local-store";

const store = createLocalStore(SESSION_KEY, parseSession);

/** The signed-in account as last told by the server, or null. Always null during server rendering and hydration. */
export function useSession(): DemoSession | null {
  return store.useValue();
}

/** Starts the copy after a sign-in, with the identity the server confirmed (see src/app/login/actions.ts). */
export function startSession(email: string, identity: SessionIdentity): DemoSession | undefined {
  return store.update((storage) => {
    const session = writeSession(storage, email, new Date(), identity);
    claimGuestActivity(storage, session);
    return session;
  });
}

/** Copies what the server says about the session, unless the copy changed while the question was out. */
export function applySession(
  requested: DemoSession | null,
  status: AccountStatus | null,
): DemoSession | null | undefined {
  return store.update((storage) => {
    const session = applyServerSession(storage, requested, status);
    if (session && session.email !== requested?.email) claimGuestActivity(storage, session);
    return session;
  });
}

let syncedThisLoad = false;

/** Once per page load: ask the server for this browser's session and correct the copy (restore, fix or clear it). */
export function syncWithServer(): void {
  if (syncedThisLoad) return;
  syncedThisLoad = true;
  const requested = store.update(readSession) ?? null;
  accountStatus()
    .then((status) => applySession(requested, status))
    .catch(() => {
      syncedThisLoad = false; // try again on the next page
    });
}

/**
 * Switches the active identity: shown at once, then made on the server, whose answer corrects the copy (it refuses
 * an employer identity the account does not have; signed out on the server clears it).
 */
export function setIdentity(identity: SessionIdentity): DemoSession | null | undefined {
  const requested = store.update((storage) => updateIdentity(storage, identity));
  if (requested) {
    void switchIdentity(identity.activeRole)
      .then((status) =>
        status
          ? store.update((storage) => syncSessionIdentity(storage, requested, status))
          : applySession(requested, null),
      )
      .catch(() => {});
  }
  return requested;
}

/** A delayed server lookup must respect identity changes made while the request was in flight. */
export function syncAccountIdentity(
  requested: DemoSession,
  status: Parameters<typeof syncSessionIdentity>[2],
): DemoSession | null | undefined {
  return store.update((storage) => syncSessionIdentity(storage, requested, status));
}

/** Ends the session: the copy at once, the cookie session on the server. */
export function signOut(): void {
  store.update(clearSession);
  void signOutAccount().catch(() => {});
}
