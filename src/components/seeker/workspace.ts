import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

/** The workspace's name for the active identity, in the page's language. */
export function workspaceTitle(isEmployer: boolean, lang: Lang = DEFAULT_LANG): string {
  const t = pick(seekerMeMessages, lang).workspace;
  return isEmployer ? t.employerTitle : t.seekerTitle;
}
