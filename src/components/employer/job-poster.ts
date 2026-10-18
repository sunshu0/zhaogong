// 职位记下是谁发的 (#182): what 职位管理 says about who posted each job, and (#186) when its contact details belong to
// someone who left the team. Pure; the server decides who is who.
import type { Phase } from "@/components/employer/job-status";

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
export function posterLabel(poster: JobPoster | undefined, teamSize: number): string | null {
  if (!poster) return null;
  switch (poster.kind) {
    case "you":
      return teamSize > 1 ? "你发布的" : null;
    case "teammate":
      return `${poster.name}发布`;
    case "left":
      return `${poster.email}发布（已离开团队）`;
    case "deleted":
      return "已删除的账号发布";
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
): string | null {
  if (!from || phase === "removed" || phase === "closed") return null;
  const who = from.kind === "left" ? `已离开团队的 ${from.email}` : "一个已删除的账号";
  return `联系方式是${who}填的，求职者可能联系不到人。请改成现在负责招聘的人。`;
}
