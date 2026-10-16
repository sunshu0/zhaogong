"use client";

// 我的主页 in this browser and on the account (#104). Every identity's page is kept here as what it changed
// (`zhaogong:profiles-by-identity`); a job seeker's page is also the account's, on the server. Each page load asks
// the server once per job seeker identity, then every change is saved here first and sent after (one at a time,
// always the whole page, so the last one sent is the page). The 企业主页 stays in this browser only.
import { useEffect, useSyncExternalStore } from "react";
import { myProfile, saveMyProfile, type ProfileSnapshot } from "@/app/profile/actions";
import { createLocalStore } from "@/components/seeker/local-store";
import { useSession } from "@/components/seeker/session-client";
import { identityScope, scopeRole, stringifyStoredIdentities } from "@/components/seeker/identity-scope";
import { initialProfile, parseStoredProfiles, type Profile } from "@/components/seeker/hub-state";
import { parseSyncMarks, samePage, syncStep, type SyncMark } from "@/components/seeker/profile-sync";

const PROFILE_KEY = "zhaogong:profiles-by-identity";
const SYNC_KEY = "zhaogong:profile-sync";
export const profileChanges = createLocalStore(PROFILE_KEY, parseStoredProfiles);
const syncMarks = createLocalStore(SYNC_KEY, parseSyncMarks);

/**
 * How the page stands with the account: `idle` before anything happened this visit, `ask` while both have a
 * different page and the person has not picked one (nothing is sent until then).
 */
export type SaveState = "idle" | "saving" | "saved" | "offline" | "ask";
type Status = { state: SaveState; account?: ProfileSnapshot };

const IDLE: Status = { state: "idle" };
let statuses: Readonly<Record<string, Status>> = {};
const statusListeners = new Set<() => void>();

function setStatus(scope: string, status: Status) {
  statuses = { ...statuses, [scope]: status };
  for (const listener of statusListeners) listener();
}

function useStatus(scope: string): Status {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => statuses[scope] ?? IDLE,
    () => IDLE,
  );
}

function readPage(scope: string): Partial<Profile> | undefined {
  return profileChanges.update((storage) => parseStoredProfiles(storage.getItem(PROFILE_KEY))[scope]);
}

/** Puts the account's page here in place of this browser's. */
function replacePage(scope: string, page: Partial<Profile>) {
  profileChanges.update((storage) => {
    const current = parseStoredProfiles(storage.getItem(PROFILE_KEY));
    storage.setItem(PROFILE_KEY, stringifyStoredIdentities({ ...current, [scope]: page }));
  });
}

function readMark(scope: string): SyncMark | undefined {
  return syncMarks.update((storage) => parseSyncMarks(storage.getItem(SYNC_KEY))[scope]);
}

function writeMark(scope: string, mark: SyncMark) {
  syncMarks.update((storage) => {
    const current = parseSyncMarks(storage.getItem(SYNC_KEY));
    storage.setItem(SYNC_KEY, JSON.stringify({ ...current, [scope]: mark }));
  });
}

// Identities whose page was compared with the account's this page load. Changes made before that are only
// marked: sending them first would put a new device's page over the account's before anyone could choose.
const compared = new Set<string>();
const asked = new Set<string>();

function compare(scope: string) {
  if (asked.has(scope)) return;
  asked.add(scope);
  (async () => {
    const account = await myProfile();
    if (!account || account.scope !== scope) return asked.delete(scope);
    const step = syncStep(readPage(scope), account, readMark(scope));
    if (step === "ask") return setStatus(scope, { state: "ask", account });
    compared.add(scope);
    if (step === "upload") return send(scope);
    if (step === "take" && account.profile) replacePage(scope, account.profile);
    if (account.updatedAt) writeMark(scope, { at: account.updatedAt });
  })().catch(() => {
    asked.delete(scope);
    if (readMark(scope)?.dirty) setStatus(scope, { state: "offline" });
  });
}

const sending = new Set<string>();
const sendAgain = new Set<string>();

async function send(scope: string) {
  if (!compared.has(scope)) return;
  if (sending.has(scope)) return void sendAgain.add(scope);
  sending.add(scope);
  setStatus(scope, { state: "saving" });
  try {
    const page = readPage(scope) ?? {};
    const answer = await saveMyProfile(page);
    if (!answer?.updatedAt || answer.scope !== scope) throw new Error("not saved");
    const changedMeanwhile = sendAgain.has(scope) || !samePage(readPage(scope), page);
    writeMark(scope, { at: answer.updatedAt, ...(changedMeanwhile ? { dirty: true } : {}) });
    setStatus(scope, { state: "saved" });
  } catch {
    setStatus(scope, { state: "offline" });
  } finally {
    sending.delete(scope);
    if (sendAgain.delete(scope)) void send(scope);
  }
}

export function useProfile() {
  const session = useSession();
  const scope = identityScope(session);
  const stored = profileChanges.useValue()[scope];
  const onAccount = Boolean(session) && scopeRole(scope) === "seeker";
  useEffect(() => {
    if (onAccount) compare(scope);
  }, [onAccount, scope]);
  return {
    profile: { ...initialProfile(session), ...stored },
    update(patch: Partial<Profile>) {
      if (!session) return;
      const saved = profileChanges.update((storage) => {
        const current = parseStoredProfiles(storage.getItem(PROFILE_KEY));
        storage.setItem(
          PROFILE_KEY,
          stringifyStoredIdentities({ ...current, [scope]: { ...current[scope], ...patch } }),
        );
        return true;
      });
      if (saved && onAccount) {
        writeMark(scope, { ...readMark(scope), dirty: true });
        // Not compared yet: the first ask failed (offline) and is not running, so this change asks again.
        if (!compared.has(scope)) compare(scope);
        else void send(scope);
      }
      return saved;
    },
  };
}

/** Where the page stands with the account, and the two answers when both have a different page. */
export function useProfileSave() {
  const session = useSession();
  const scope = identityScope(session);
  const status = useStatus(scope);
  const onAccount = Boolean(session) && scopeRole(scope) === "seeker";
  return {
    onAccount,
    state: status.state,
    /** The account's page, while asking. */
    account: status.state === "ask" ? status.account : undefined,
    keepAccount() {
      const account = status.account;
      if (status.state !== "ask" || !account?.profile || !account.updatedAt) return;
      replacePage(scope, account.profile);
      writeMark(scope, { at: account.updatedAt });
      compared.add(scope);
      setStatus(scope, { state: "saved" });
    },
    keepDevice() {
      const account = status.account;
      if (status.state !== "ask" || !account?.updatedAt) return;
      writeMark(scope, { at: account.updatedAt, dirty: true });
      compared.add(scope);
      void send(scope);
    },
  };
}
