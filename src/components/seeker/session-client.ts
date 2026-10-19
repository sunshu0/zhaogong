"use client";

// The browser's copy of the session, for display only. The real session is the httpOnly cookie on the server
// (src/lib/auth, A12-1); every Server Function reads that. The copy is filled from the server's answers and
// corrected once per page load (syncWithServer), so editing localStorage signs nobody in.
import { accountStatus, signOutAccount, switchIdentity, type AccountStatus } from "@/app/[lang]/login/actions";
import { createLocalStore } from "@/components/seeker/local-store";
import { claimGuestActivity } from "@/components/seeker/identity-activity";
import { applyServerSession, syncSessionIdentity, unconfirmedSwitch } from "@/components/seeker/identity";
import {
  clearSession,
  parseSession,
  readSession,
  requestIdentity,
  SESSION_KEY,
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

/** Starts the copy after a sign-in, with the identity the server confirmed (see src/app/[lang]/login/actions.ts). */
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

/**
 * Once per page load: ask the server for this browser's session and correct the copy (restore, fix or clear it).
 * A switch the server never got (the page was left first) is sent again rather than undone.
 */
export function syncWithServer(): void {
  if (syncedThisLoad) return;
  syncedThisLoad = true;
  const requested = store.update(readSession) ?? null;
  accountStatus()
    .then((status) => {
      const role = unconfirmedSwitch(requested, status);
      if (!role) return applySession(requested, status);
      return switchIdentity(role).then((answer) => applySession(requested, answer));
    })
    .catch(() => {
      syncedThisLoad = false; // try again on the next page
    });
}

/**
 * Switches the active identity: shown at once, then made on the server, whose answer corrects the copy (it refuses
 * an employer identity the account does not have; signed out on the server clears it).
 */
export function setIdentity(identity: SessionIdentity): DemoSession | null | undefined {
  const requested = store.update((storage) => requestIdentity(storage, identity));
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

/**
 * Ends the session: the cookie session on the server, then the copy. Wait for it before leaving the page: Server
 * Function calls go one at a time, so the sign-out can still be queued behind another call, and a page load in the
 * meantime cancels it and leaves the cookie session alive (#73: the page that showed 退出登录 was still asking
 * whether the account may moderate). False when the server did not answer: the copy stays, since the account is
 * still signed in there, and the caller says so and stays on the page (#254: on a shared computer, a sign-out that
 * only looked done left the account open).
 */
export async function signOut(): Promise<boolean> {
  const done = await signOutAccount().then(
    () => true,
    () => false,
  );
  if (done) store.update(clearSession);
  return done;
}
