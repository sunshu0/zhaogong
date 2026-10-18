// 职位记下是谁发的 (#182): what 职位管理 says about who posted each job. Pure; the server decides who is who.

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
