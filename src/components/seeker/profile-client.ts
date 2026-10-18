"use client";

// 我的主页 in this browser and on the server (#104), and the 企业主页 (ADR 0022). Every identity's page is kept here
// as what it changed (`zhaogong:profiles-by-identity`). A job seeker's page is also the account's; a business's page
// (its public fields) is the business's, shared by its team, and only an admin changes it. Each page load asks the
// server once per identity, then every change is saved here first and sent after (one at a time, always the whole
// page, so the last one sent is the page). A member sees the business's page as the server has it, read-only.
import { useEffect, useSyncExternalStore } from "react";
import { myProfile, saveMyProfile, type ProfileSnapshot } from "@/app/profile/actions";
import { myEmployerPage, saveMyEmployerPage, type EmployerPageSnapshot } from "@/app/employer/page-actions";
import { createLocalStore } from "@/components/seeker/local-store";
import { useSession } from "@/components/seeker/session-client";
import { identityScope, scopeRole, stringifyStoredIdentities } from "@/components/seeker/identity-scope";
import { initialProfile, parseStoredProfiles, type Profile } from "@/components/seeker/hub-state";
import { parseSyncMarks, samePage, syncStep, type SyncMark } from "@/components/seeker/profile-sync";
import { pagePart, personalPart, touchesPage } from "@/components/employer/employer-page";
import { forgetPublicPage } from "@/components/employer/public-pages-client";
import type { PageFinding } from "@/components/employer/employer-page-check";

const PROFILE_KEY = "zhaogong:profiles-by-identity";
const SYNC_KEY = "zhaogong:profile-sync";
export const profileChanges = createLocalStore(PROFILE_KEY, parseStoredProfiles);
const syncMarks = createLocalStore(SYNC_KEY, parseSyncMarks);

/**
 * The server's page for one identity: `canEdit` is false for a member of a business (ADR 0022), `admins` then
 * names who can change it.
 */
export type AccountPage = ProfileSnapshot & { canEdit: boolean; admins: string[]; refused?: PageFinding[] };

/** How one identity's page reaches the server: a job seeker's whole page, or the business's part of it. */
type Remote = {
  load(): Promise<AccountPage | null>;
  save(page: Partial<Profile>): Promise<AccountPage | null>;
  /** The part of this browser's page the server keeps. */
  part(page: Partial<Profile> | undefined): Partial<Profile>;
  /** This browser's page once it takes the server's. */
  take(local: Partial<Profile> | undefined, server: Partial<Profile>): Partial<Profile>;
  /** Whether a change has to reach the server. */
  touches(patch: Partial<Profile>): boolean;
};

const seekerPage = (s: ProfileSnapshot | null): AccountPage | null => s && { ...s, canEdit: true, admins: [] };
const businessPage = (s: EmployerPageSnapshot | null): AccountPage | null =>
  s && {
    scope: s.scope,
    profile: s.page,
    updatedAt: s.updatedAt,
    canEdit: s.canEdit,
    admins: s.admins,
    ...(s.refused ? { refused: s.refused } : {}),
  };

const SEEKER: Remote = {
  load: async () => seekerPage(await myProfile()),
  save: async (page) => seekerPage(await saveMyProfile(page)),
  part: (page) => page ?? {},
  take: (_local, server) => server,
  touches: () => true,
};

// The 私密交换资料 stay with each person, here: every teammate gives their own phone and WeChat in a chat.
const BUSINESS: Remote = {
  load: async () => businessPage(await myEmployerPage()),
  save: async (page) => businessPage(await saveMyEmployerPage(pagePart(page))),
  part: pagePart,
  take: (local, server) => ({ ...personalPart(local), ...server }),
  touches: touchesPage,
};

function remoteOf(scope: string): Remote | undefined {
  const role = scopeRole(scope);
  return role === "seeker" ? SEEKER : role === "employer" ? BUSINESS : undefined;
}

/**
 * How the page stands with the server: `idle` before anything happened this visit, `ask` while both have a
 * different page and the person has not picked one (nothing is sent until then), `readonly` for a member of a
 * business, who sees the business's page as the server has it; `refused` while a business's page has something that
 * cannot be public (#195): nothing was saved, and the next change is sent again.
 */
export type SaveState = "idle" | "saving" | "saved" | "offline" | "ask" | "readonly" | "refused";
type Status = { state: SaveState; account?: AccountPage };

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

/** Puts the server's page here in place of this browser's. */
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

/** The business of an employer identity's scope, so its public page is asked for again after a save. */
function businessOf(scope: string): string | undefined {
  if (scopeRole(scope) !== "employer") return undefined;
  const id: unknown = (JSON.parse(scope) as unknown[])[2];
  return typeof id === "string" ? id : undefined;
}

// Identities whose page was compared with the server's this page load. Changes made before that are only marked:
// sending them first would put a new device's page over the server's before anyone could choose.
const compared = new Set<string>();
const asked = new Set<string>();

function compare(scope: string) {
  const remote = remoteOf(scope);
  if (!remote || asked.has(scope)) return;
  asked.add(scope);
  (async () => {
    const account = await remote.load();
    if (!account || account.scope !== scope) return asked.delete(scope);
    // A member does not send: the page shown is the server's, and this browser's own copy is left as it was.
    if (!account.canEdit) return setStatus(scope, { state: "readonly", account });
    const step = syncStep(remote.part(readPage(scope)), account, readMark(scope));
    if (step === "ask") return setStatus(scope, { state: "ask", account });
    compared.add(scope);
    if (step === "upload") return send(scope);
    if (step === "take" && account.profile) replacePage(scope, remote.take(readPage(scope), account.profile));
    if (account.updatedAt) writeMark(scope, { at: account.updatedAt });
  })().catch(() => {
    asked.delete(scope);
    if (readMark(scope)?.dirty) setStatus(scope, { state: "offline" });
  });
}

const sending = new Set<string>();
const sendAgain = new Set<string>();

async function send(scope: string) {
  const remote = remoteOf(scope);
  if (!remote || !compared.has(scope)) return;
  if (sending.has(scope)) return void sendAgain.add(scope);
  sending.add(scope);
  setStatus(scope, { state: "saving" });
  try {
    const page = readPage(scope) ?? {};
    const answer = await remote.save(page);
    if (answer && answer.scope === scope && !answer.canEdit) {
      // No longer an admin of the business: nothing was saved, and the page shown is the server's from now on.
      compared.delete(scope);
      return setStatus(scope, { state: "readonly", account: answer });
    }
    // Something on the page cannot be public (#195): nothing was saved; the change stays marked for the next send.
    if (answer && answer.scope === scope && answer.refused)
      return setStatus(scope, { state: "refused", account: answer });
    if (!answer?.updatedAt || answer.scope !== scope) throw new Error("not saved");
    const changedMeanwhile = sendAgain.has(scope) || !samePage(remote.part(readPage(scope)), remote.part(page));
    writeMark(scope, { at: answer.updatedAt, ...(changedMeanwhile ? { dirty: true } : {}) });
    setStatus(scope, { state: "saved" });
    const business = businessOf(scope);
    if (business) forgetPublicPage(business);
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
  const status = useStatus(scope);
  const remote = session ? remoteOf(scope) : undefined;
  useEffect(() => {
    if (remote) compare(scope);
  }, [remote, scope]);
  const readOnly = status.state === "readonly" ? status.account : undefined;
  return {
    profile: {
      ...initialProfile(session),
      ...(remote && readOnly ? remote.take(stored, readOnly.profile ?? {}) : stored),
    },
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
      if (saved && remote?.touches(patch) && statuses[scope]?.state !== "readonly") {
        writeMark(scope, { ...readMark(scope), dirty: true });
        // Not compared yet: the first ask failed (offline) and is not running, so this change asks again.
        if (!compared.has(scope)) compare(scope);
        else void send(scope);
      }
      return saved;
    },
  };
}

/** Where the page stands with the server, and the two answers when both have a different page. */
export function useProfileSave() {
  const session = useSession();
  const scope = identityScope(session);
  const status = useStatus(scope);
  const remote = session ? remoteOf(scope) : undefined;
  return {
    onAccount: Boolean(remote),
    state: status.state,
    /** The server's page, while asking. */
    account: status.state === "ask" ? status.account : undefined,
    /** Who can change the business's page, when this person cannot (ADR 0022). */
    admins: status.state === "readonly" ? (status.account?.admins ?? []) : undefined,
    /** What on the business's page cannot be public, when the last save was refused (#195). */
    refused: status.state === "refused" ? (status.account?.refused ?? []) : undefined,
    keepAccount() {
      const account = status.account;
      if (!remote || status.state !== "ask" || !account?.profile || !account.updatedAt) return;
      replacePage(scope, remote.take(readPage(scope), account.profile));
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
