// 职位记下是谁发的 (#182): what 职位管理 says about who posted each job, and (#186) when its contact details belong to
// someone who left the team. Pure; the server decides who is who.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import type { Phase } from "@/components/employer/job-status";

const words = (lang: Lang) => pick(employerJobsMessages, lang).poster;

/** Who posted a job, as the person looking at 职位管理 should hear it. */
export type JobPoster =
  | { kind: "you" }
  | { kind: "teammate"; name: string } // the team name, or the email when they set none
  | { kind: "left"; email: string } // no longer in this business's team
  | { kind: "deleted" }; // the account is gone

/**
 * The line on a job's card, or null when there is nothing worth saying: a job from before #182, or your own job in a
 * business that is only you.
 */
export function posterLabel(poster: JobPoster | undefined, teamSize: number, lang: Lang = DEFAULT_LANG): string | null {
  const t = words(lang);
  if (!poster) return null;
  switch (poster.kind) {
    case "you":
      return teamSize > 1 ? t.you : null;
    case "teammate":
      return t.teammate(poster.name);
    case "left":
      return t.left(poster.email);
    case "deleted":
      return t.deleted;
  }
}

type ContactSide = { contactPublic: boolean; contact: { phone?: string; wechat?: string; email?: string } };

/** Whether an edit left the job's contact details as they were (#186): the same choice, the same details. */
export function sameContact(a: ContactSide, b: ContactSide): boolean {
  const value = (side: ContactSide, key: "phone" | "wechat" | "email") => side.contact[key]?.trim() ?? "";
  return (
    a.contactPublic === b.contactPublic &&
    (["phone", "wechat", "email"] as const).every((key) => value(a, key) === value(b, key))
  );
}

/**
 * The warning on a job whose public contact details were filled by someone no longer in the team (#186), or null.
 * Jobs that are down or ended by the business need none: nobody reaches them.
 */
export function staleContactNote(
  from: Extract<JobPoster, { kind: "left" | "deleted" }> | undefined,
  phase: Phase,
  lang: Lang = DEFAULT_LANG,
): string | null {
  const t = words(lang);
  if (!from || phase === "removed" || phase === "closed") return null;
  const who = from.kind === "left" ? t.staleFromLeft(from.email) : t.staleFromDeleted;
  return t.staleContact(who);
}
