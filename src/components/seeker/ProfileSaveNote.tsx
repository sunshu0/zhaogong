"use client";

// Where the page stands (#104): saved to the account, saving, or only on this device. A 企业主页 is saved to the
// business (ADR 0022), and a member of its team only reads it.
import { Button } from "@/components/ui/Button";
import { initialProfile } from "@/components/seeker/hub-state";
import { useProfile, useProfileSave, type SaveState } from "@/components/seeker/profile-client";
import { useSession } from "@/components/seeker/session-client";
import { useLang, useMessages } from "@/i18n/client";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";
import { uiMessages } from "@/i18n/messages/ui";
import { contentLang, DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";

/**
 * The line under the page. `localSave`: whether the last change could be kept in this browser at all; `business`:
 * the page is a 企业主页.
 */
export function saveNote(
  state: SaveState,
  onAccount: boolean,
  localSave: boolean | null,
  business = false,
  lang: Lang = DEFAULT_LANG,
): string {
  const t = pick(seekerProfileMessages, lang).saveNote;
  if (localSave === false) return t.blocked;
  if (!onAccount) return localSave ? t.savedHere : t.keptHere;
  switch (state) {
    case "saving":
      return t.saving;
    case "saved":
      return business ? t.savedBusiness : t.saved;
    case "refused":
      return t.refused;
    case "readonly":
      return localSave ? t.savedHere : t.readonly;
    case "offline":
      return t.offline;
    case "unreached":
      return t.unreached;
    case "ask":
      return t.chooseFirst;
    default:
      return business ? t.autosavesBusiness : t.autosaves;
  }
}

export function ProfileSaveNote({ localSave, className = "" }: { localSave: boolean | null; className?: string }) {
  const lang = useLang();
  const session = useSession();
  const { state, onAccount, retry } = useProfileSave();
  const retryWord = useMessages(uiMessages).load.retry;
  const failed =
    localSave === false || (onAccount && (state === "offline" || state === "unreached" || state === "refused"));
  const note = (
    <p role="status" className={`${className} text-meta ${failed ? "text-danger" : "text-muted"}`.trim()}>
      {saveNote(state, onAccount, localSave, session?.activeRole === "employer", lang)}
    </p>
  );
  if (!onAccount || localSave === false || (state !== "offline" && state !== "unreached")) return note;
  // No answer from the account: 重试 beside the note (#252), since a server restarting brings no `online` event.
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      {note}
      <button type="button" onClick={retry} className="pressable min-h-11 text-meta font-medium text-brand">
        {retryWord}
      </button>
    </div>
  );
}

/** When this device and the account each have a different page: the person keeps one. */
export function ProfileChoice() {
  const t = useMessages(seekerProfileMessages).saveNote;
  const session = useSession();
  const { profile } = useProfile();
  const { account, keepAccount, keepDevice } = useProfileSave();
  if (!account?.profile) return null;
  // A 企业主页 is the business's (ADR 0022): what this device has meets what the team's page is now.
  const employer = session?.activeRole === "employer";
  const server = employer ? t.onBusiness : t.onAccount;
  const summary = (page: { name?: string; headline?: string }) =>
    [page.name, page.headline].filter(Boolean).join(" · ") || t.noName;
  return (
    <section
      aria-labelledby="profile-choice-title"
      className="space-y-3 rounded-md border border-brand/40 bg-brand-soft p-4"
    >
      <h2 id="profile-choice-title" className="text-body font-semibold">
        {employer ? t.differBusiness : t.differ}
      </h2>
      <dl className="grid gap-1 text-meta sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-muted">{server}</dt>
        <dd lang={contentLang(summary({ ...initialProfile(session), ...account.profile }))}>
          {summary({ ...initialProfile(session), ...account.profile })}
        </dd>
        <dt className="text-muted">{t.onDevice}</dt>
        <dd lang={contentLang(summary(profile))}>{summary(profile)}</dd>
      </dl>
      <p className="text-meta text-muted">{t.keepOne}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={keepAccount}>{employer ? t.useBusiness : t.useAccount}</Button>
        <Button variant="secondary" onClick={keepDevice}>
          {t.useDevice}
        </Button>
      </div>
    </section>
  );
}
