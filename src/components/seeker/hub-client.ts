"use client";

import { useLang } from "@/i18n/client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { markMyNotificationsRead, myNotificationReads, type ReadsSnapshot } from "@/app/[lang]/messages/actions";
import { myAlertNotifications } from "@/app/[lang]/me/alerts/actions";
import { createLocalStore } from "@/components/seeker/local-store";
import { profileChanges } from "@/components/seeker/profile-client";
import { useSession } from "@/components/seeker/session-client";
import { identityScope, stringifyStoredIdentities } from "@/components/seeker/identity-scope";
import {
  notificationsFor,
  parseNotificationReads,
  resolveProfiles,
  type Notification,
} from "@/components/seeker/hub-state";
import { MOCK_CANDIDATES } from "@/mock/candidates";
import { recommendedCandidates } from "@/app/[lang]/profile/candidate-actions";
import type { Candidate } from "@/lib/candidate-matching";
import { employerPublicProfile } from "@/lib/employer-public-profile";
import { usePublicPage } from "@/components/employer/public-pages-client";

const NOTIFICATIONS_KEY = "zhaogong:notifications-by-identity";

// The profile store and its sync with the account moved to profile-client.ts (#104); importers keep this path.
export { useProfile, useProfileSave } from "@/components/seeker/profile-client";

/** Every stored identity's profile with defaults filled in: this browser's 企业主页 until the server's arrives. */
function useAllProfiles() {
  const stored = profileChanges.useValue();
  return useMemo(() => resolveProfiles(stored), [stored]);
}
const notificationReads = createLocalStore(NOTIFICATIONS_KEY, parseNotificationReads);

/**
 * A business's public page (ADR 0022): the server's, the same for every visitor; undefined when it has none. While
 * the server has not answered, this browser's own copy (when it is the business's) stands in.
 */
export function usePublicEmployerProfile(employerId: string) {
  const local = employerPublicProfile(useAllProfiles(), employerId);
  const server = usePublicPage(employerId);
  return server === undefined ? local : (server ?? undefined);
}

// 推荐人才 (#104): the job seekers who allowed it come from their accounts, fetched once per employer identity per
// page load. The demo candidates are always there.
type Directory = { scope: string; candidates: readonly Candidate[] };
let directory: Directory | null = null;
const directoryListeners = new Set<() => void>();
const directoryScopes = new Set<string>();
// The identity whose accounts' candidates got no answer (#250), so a page can say so instead of its skeleton.
let directoryFailed: string | null = null;

function setDirectoryFailed(scope: string | null) {
  directoryFailed = scope;
  for (const listener of directoryListeners) listener();
}

function loadDirectory(scope: string) {
  if (directoryScopes.has(scope)) return;
  directoryScopes.add(scope);
  recommendedCandidates()
    .then((answer) => {
      if (!answer || answer.scope !== scope) return directoryScopes.delete(scope);
      directory = answer;
      setDirectoryFailed(null);
    })
    .catch(() => {
      directoryScopes.delete(scope);
      setDirectoryFailed(scope);
    });
}

const subscribeDirectory = (listener: () => void) => {
  directoryListeners.add(listener);
  return () => directoryListeners.delete(listener);
};

function useDirectory(): Directory | null {
  return useSyncExternalStore(
    (listener) => {
      directoryListeners.add(listener);
      return () => directoryListeners.delete(listener);
    },
    () => directory,
    () => null,
  );
}

/**
 * The candidates 推荐人才 can show, whether the accounts' ones have arrived (always true off employer), and whether
 * they got no answer (`failed`, with `reload` for 重试).
 */
export function useCandidateDirectory(): {
  candidates: Candidate[];
  loaded: boolean;
  failed: boolean;
  reload: () => void;
} {
  const session = useSession();
  const scope = identityScope(session);
  const isEmployer = session?.activeRole === "employer";
  const answer = useDirectory();
  const failedScope = useSyncExternalStore(
    subscribeDirectory,
    () => directoryFailed,
    () => null,
  );
  useEffect(() => {
    if (isEmployer) loadDirectory(scope);
  }, [isEmployer, scope]);
  const mine = isEmployer && answer?.scope === scope ? answer.candidates : null;
  return {
    candidates: [...MOCK_CANDIDATES, ...(mine ?? [])],
    loaded: !isEmployer || mine !== null,
    failed: isEmployer && mine === null && failedScope === scope,
    reload: () => {
      setDirectoryFailed(null);
      loadDirectory(scope);
    },
  };
}

/** Keeps the server's answer as the copy of the identity it is for (see chat-client.ts). */
function keepReads(snapshot: ReadsSnapshot | null) {
  if (!snapshot) return;
  notificationReads.update((storage) => {
    const current = parseNotificationReads(storage.getItem(NOTIFICATIONS_KEY));
    storage.setItem(NOTIFICATIONS_KEY, stringifyStoredIdentities({ ...current, [snapshot.scope]: snapshot.ids }));
  });
}

// Which notifications are read is kept on the server (#10); this copy is a cache, refreshed once per identity per
// page load. Reads only this browser had from before #10 are handed to the server once.
const syncedScopes = new Set<string>();

function syncReads(scope: string) {
  if (syncedScopes.has(scope)) return;
  syncedScopes.add(scope);
  (async () => {
    const server = await myNotificationReads();
    if (!server || server.scope !== scope) return syncedScopes.delete(scope);
    const local = notificationReads.update(
      (storage) => parseNotificationReads(storage.getItem(NOTIFICATIONS_KEY))[scope],
    );
    const missing = (local ?? []).filter((id) => !server.ids.includes(id));
    keepReads(missing.length ? await markMyNotificationsRead(missing) : server);
  })().catch(() => syncedScopes.delete(scope));
}

// The jobs the account's job alerts found (#53) are on the server only: fetched once per identity per page load.
let alertItems: Readonly<Record<string, readonly Notification[]>> = {};
const alertListeners = new Set<() => void>();
const alertScopes = new Set<string>();
const NO_ITEMS: readonly Notification[] = [];
// The identity whose alert notifications got no answer (#252): the page says so rather than showing fewer as all.
let alertsFailed: string | null = null;

function loadAlertItems(scope: string) {
  if (alertScopes.has(scope)) return;
  alertScopes.add(scope);
  myAlertNotifications()
    .then((answer) => {
      if (!answer || answer.scope !== scope) return alertScopes.delete(scope);
      alertItems = { ...alertItems, [scope]: answer.items };
      if (alertsFailed === scope) alertsFailed = null;
      for (const listener of alertListeners) listener();
    })
    .catch(() => {
      alertScopes.delete(scope);
      alertsFailed = scope;
      for (const listener of alertListeners) listener();
    });
}

const subscribeAlerts = (listener: () => void) => {
  alertListeners.add(listener);
  return () => alertListeners.delete(listener);
};

/**
 * For the notifications page: asks the server again on opening it, so jobs found since the page loaded show.
 * `failed` when the jobs the alerts found got no answer, with `reload` for 重试.
 */
export function useFreshAlertNotifications(): { failed: boolean; reload: () => void } {
  const session = useSession();
  const scope = identityScope(session);
  const signedIn = Boolean(session);
  const failedScope = useSyncExternalStore(
    subscribeAlerts,
    () => alertsFailed,
    () => null,
  );
  useEffect(() => {
    if (!signedIn) return;
    alertScopes.delete(scope);
    loadAlertItems(scope);
  }, [signedIn, scope]);
  return {
    failed: signedIn && failedScope === scope,
    reload: () => {
      alertsFailed = null;
      for (const listener of alertListeners) listener();
      loadAlertItems(scope);
    },
  };
}

function useAlertItems(scope: string): readonly Notification[] {
  return useSyncExternalStore(
    (listener) => {
      alertListeners.add(listener);
      return () => alertListeners.delete(listener);
    },
    () => alertItems[scope] ?? NO_ITEMS,
    () => NO_ITEMS,
  );
}

export function useNotifications() {
  const session = useSession();
  const scope = identityScope(session);
  const items = notificationsFor(session, notificationReads.useValue()[scope] ?? [], useAlertItems(scope), useLang());
  const signedIn = Boolean(session);
  useEffect(() => {
    if (!signedIn) return;
    syncReads(scope);
    loadAlertItems(scope);
  }, [signedIn, scope]);
  return {
    items,
    unread: session ? items.filter((item) => item.unread).length : 0,
    markRead(id?: string) {
      if (!session) return;
      notificationReads.update((storage) => {
        const current = parseNotificationReads(storage.getItem(NOTIFICATIONS_KEY));
        const ids = id ? [id] : items.map((item) => item.id);
        const read = [...new Set([...(current[scope] ?? []), ...ids])];
        storage.setItem(NOTIFICATIONS_KEY, stringifyStoredIdentities({ ...current, [scope]: read }));
      });
      markMyNotificationsRead(id ? [id] : "all")
        .then(keepReads)
        .catch(() => {});
    },
  };
}
