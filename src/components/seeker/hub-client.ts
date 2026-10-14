"use client";

import { useMemo } from "react";
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

export function useNotifications() {
  const session = useSession();
  const scope = identityScope(session);
  const items = notificationsFor(session, notificationReads.useValue()[scope] ?? []);
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
    },
  };
}
