"use client";

import { createLocalStore } from "@/components/seeker/local-store";
import { useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { initialNotifications, initialProfile, parseNotifications, parseProfiles, type Notification, type Profile } from "@/components/seeker/hub-state";
import { MOCK_CANDIDATES } from "@/mock/candidates";
import { localCandidates } from "@/lib/candidate-directory";
import { employerPublicProfile } from "@/lib/employer-public-profile";

const PROFILE_KEY = "zhaogong:profiles-by-identity";
const NOTIFICATIONS_KEY = "zhaogong:notifications-by-identity";
const profiles = createLocalStore(PROFILE_KEY, parseProfiles);
const notifications = createLocalStore(NOTIFICATIONS_KEY, parseNotifications);

export function usePublicEmployerProfile(employerId: string) {
  return employerPublicProfile(profiles.useValue(), employerId);
}

export function useCandidateDirectory() {
  const accounts = profiles.useValue();
  const session = useSession();
  return [...MOCK_CANDIDATES, ...localCandidates(accounts, session)];
}

export function useProfile() {
  const session = useSession();
  const scope = identityScope(session);
  const accounts = profiles.useValue();
  return {
    profile: accounts[scope] ?? initialProfile(session),
    update(patch: Partial<Profile>) {
      if (!session) return;
      return profiles.update((storage) => {
        const current = parseProfiles(storage.getItem(PROFILE_KEY));
        storage.setItem(PROFILE_KEY, JSON.stringify({ ...current, [scope]: { ...(current[scope] ?? initialProfile(session)), ...patch } }));
        return true;
      });
    },
  };
}

export function useNotifications() {
  const session = useSession();
  const scope = identityScope(session);
  const accounts = notifications.useValue();
  const items = accounts[scope] ?? initialNotifications(session);
  return {
    items,
    unread: session ? items.filter((item) => item.unread).length : 0,
    markRead(id?: string) {
      if (!session) return;
      notifications.update((storage) => {
        const current = parseNotifications(storage.getItem(NOTIFICATIONS_KEY));
        const updated: Notification[] = (current[scope] ?? initialNotifications(session)).map((item) => !id || item.id === id ? { ...item, unread: false } : item);
        storage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ ...current, [scope]: updated }));
      });
    },
  };
}
