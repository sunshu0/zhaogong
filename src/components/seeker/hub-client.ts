"use client";

import { useEffect, useMemo } from "react";
import { markMyNotificationsRead, myNotificationReads, type ReadsSnapshot } from "@/app/messages/actions";
import { createLocalStore } from "@/components/seeker/local-store";
import { useSession } from "@/components/seeker/session-client";
import { identityScope, stringifyStoredIdentities } from "@/components/seeker/identity-scope";
import {
  initialProfile,
  notificationsFor,
  parseNotificationReads,
  parseStoredProfiles,
  resolveProfiles,
  type Profile,
} from "@/components/seeker/hub-state";
import { MOCK_CANDIDATES } from "@/mock/candidates";
import { localCandidates } from "@/lib/candidate-directory";
import { employerPublicProfile } from "@/lib/employer-public-profile";

const PROFILE_KEY = "zhaogong:profiles-by-identity";
const NOTIFICATIONS_KEY = "zhaogong:notifications-by-identity";
const changes = createLocalStore(PROFILE_KEY, parseStoredProfiles);

/** Every stored identity's profile with defaults filled in (other people's, for public pages in this browser). */
function useAllProfiles() {
  const stored = changes.useValue();
  return useMemo(() => resolveProfiles(stored), [stored]);
}
const notificationReads = createLocalStore(NOTIFICATIONS_KEY, parseNotificationReads);

export function usePublicEmployerProfile(employerId: string) {
  return employerPublicProfile(useAllProfiles(), employerId);
}

export function useCandidateDirectory() {
  const accounts = useAllProfiles();
  const session = useSession();
  return [...MOCK_CANDIDATES, ...localCandidates(accounts, session)];
}

export function useProfile() {
  const session = useSession();
  const scope = identityScope(session);
  const stored = changes.useValue()[scope];
  return {
    profile: { ...initialProfile(session), ...stored },
    update(patch: Partial<Profile>) {
      if (!session) return;
      return changes.update((storage) => {
        const current = parseStoredProfiles(storage.getItem(PROFILE_KEY));
        storage.setItem(
          PROFILE_KEY,
          stringifyStoredIdentities({ ...current, [scope]: { ...current[scope], ...patch } }),
        );
        return true;
      });
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

export function useNotifications() {
  const session = useSession();
  const scope = identityScope(session);
  const items = notificationsFor(session, notificationReads.useValue()[scope] ?? []);
  const signedIn = Boolean(session);
  useEffect(() => {
    if (signedIn) syncReads(scope);
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
