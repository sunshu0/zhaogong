// 雇主多人管理 (#87, PRD R-38, ADR 0012): who in a business's team may do what, and which team changes are allowed.
// Pure; the server checks every change with these before writing it.

/** An admin runs the team, the business profile and 企业验证; a member posts and handles jobs, applicants and chats. */
export type TeamRole = "admin" | "member";

export type TeamInviteStatus = "pending" | "accepted" | "declined" | "cancelled";

/** `page`: the business's 企业主页 (ADR 0022). */
export type TeamPermission = "post" | "jobs" | "applicants" | "chat" | "verify" | "team" | "page";

const ADMIN_ONLY: readonly TeamPermission[] = ["verify", "team", "page"];

export function teamCan(role: TeamRole | undefined, permission: TeamPermission): boolean {
  if (!role) return false;
  return role === "admin" || !ADMIN_ONLY.includes(permission);
}

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = { admin: "管理员", member: "成员" };

/** People in one business, the admins included. */
export const TEAM_MAX = 10;

/** The name a teammate goes by in the business's chats, e.g. 王经理. */
export const TEAM_NAME_MAX = 12;

export function checkTeamName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "请填写称呼，例如「王经理」。" };
  if ([...name].length > TEAM_NAME_MAX) return { ok: false, error: `称呼最多 ${TEAM_NAME_MAX} 个字。` };
  if (/[@＠]|\d{5,}/.test(name)) return { ok: false, error: "称呼里不要写邮箱或电话。" };
  return { ok: true, name };
}

/** How the business side signs in a chat: the shop, and who replied when the team has given a name. */
export function teamSignature(employerName: string, teamName: string | null | undefined): string {
  return teamName ? `${employerName} · ${teamName}` : employerName;
}

export interface TeamMember {
  email: string;
  role: TeamRole;
  name: string | null;
  joinedAt: string | null;
}

export type TeamChange =
  | { type: "role"; email: string; role: TeamRole }
  | { type: "remove"; email: string } // by an admin; removing yourself is leaving
  | { type: "leave" };

export type TeamRefusal = "not_member" | "not_admin" | "no_such_member" | "last_admin";

/** Whether `actor` may make `change`; undefined when allowed. A team always keeps at least one admin. */
export function checkTeamChange(members: TeamMember[], actor: string, change: TeamChange): TeamRefusal | undefined {
  const me = members.find((m) => m.email === actor);
  if (!me) return "not_member";
  const target = change.type === "leave" ? me : members.find((m) => m.email === change.email);
  if (change.type !== "leave" && me.role !== "admin") return "not_admin";
  if (!target) return "no_such_member";
  const admins = members.filter((m) => m.role === "admin").length;
  const losesAdmin = target.role === "admin" && (change.type !== "role" || change.role !== "admin");
  if (losesAdmin && admins <= 1) return "last_admin";
  return undefined;
}

export const TEAM_REFUSAL_TEXT: Record<TeamRefusal, string> = {
  not_member: "你已经不在这家企业的团队里了。",
  not_admin: "只有管理员能管理团队。",
  no_such_member: "这个人已经不在团队里了。",
  last_admin: "团队里至少要有一位管理员：先把另一位成员设为管理员。",
};

/** Admins first, then by when they joined (the founder's join time is when the business was opened). */
export function sortTeam(members: TeamMember[]): TeamMember[] {
  return [...members].sort(
    (a, b) =>
      (a.role === b.role ? 0 : a.role === "admin" ? -1 : 1) ||
      (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "") ||
      a.email.localeCompare(b.email),
  );
}
