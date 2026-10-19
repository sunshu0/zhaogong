// 雇主多人管理 (#87, PRD R-38, ADR 0012): who in a business's team may do what, and which team changes are allowed.
// Pure; the server checks every change with these before writing it. The wording comes from the 团队 dictionary
// (Round 20, ADR 0023): every function that builds text takes the reader's language, Chinese when not told.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerTeamMessages } from "@/i18n/messages/employer-team";

const words = (lang: Lang) => pick(employerTeamMessages, lang).team;

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

/** 管理员 / 成员 in the reader's language. */
export function teamRoleLabel(lang: Lang = DEFAULT_LANG): Record<TeamRole, string> {
  return words(lang).roleLabel;
}

/** People in one business, the admins included. */
export const TEAM_MAX = 10;

/**
 * An invitation nobody answered within this many days has expired (#194, ADR 0012): it no longer holds a place in the
 * team and can no longer be accepted. Decided when read, like a job's closing date (ADR 0008); nothing runs on a timer.
 */
export const INVITE_DAYS = 14;

/**
 * Invitations one business may send in 24 hours, whatever became of them (#197): each lands in the invited account's
 * 通知, so sending, cancelling and sending again must not reach any number of people. Invitation links count too
 * (#349, ADR 0028): emails and links together.
 */
export const INVITES_PER_DAY = 20;

export function inviteExpired(createdAt: string, now: number): boolean {
  return now - Date.parse(createdAt) > INVITE_DAYS * 86_400_000;
}

/**
 * An invitation link (#349, ADR 0028): `open` until someone joins with it (`used`) or an admin takes it back
 * (`revoked`). It expires LINK_DAYS after it was made, decided when read, like an invitation (#194).
 */
export type TeamLinkStatus = "open" | "used" | "revoked";

export const LINK_DAYS = 7;

export function linkExpired(createdAt: string, now: number): boolean {
  return now - Date.parse(createdAt) > LINK_DAYS * 86_400_000;
}

/** When a link made at `createdAt` stops working. */
export function linkExpiresAt(createdAt: string): string {
  return new Date(Date.parse(createdAt) + LINK_DAYS * 86_400_000).toISOString();
}

/**
 * Whether a team has no place for another invitation (#296): its members and the invitations not expired yet reach
 * TEAM_MAX. inviteToTeam refuses with "full" then, and 团队 says so before anyone types an email. `liveInvites`
 * counts the open links not expired yet as well (#349).
 */
export function teamFull(members: number, liveInvites: number): boolean {
  return members + liveInvites >= TEAM_MAX;
}

/** The name a teammate goes by in the business's chats, e.g. 王经理. */
export const TEAM_NAME_MAX = 12;

export function checkTeamName(
  raw: string,
  lang: Lang = DEFAULT_LANG,
): { ok: true; name: string } | { ok: false; error: string } {
  const t = words(lang);
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: t.nameRequired };
  if ([...name].length > TEAM_NAME_MAX) return { ok: false, error: t.nameTooLong(TEAM_NAME_MAX) };
  if (/[@＠]|\d{5,}/.test(name)) return { ok: false, error: t.nameNoContact };
  return { ok: true, name };
}

/**
 * How the business side signs in a chat: the shop, and who replied when the team has given a name. Both names are
 * the business's own words, so the line reads the same in either language and takes no `lang`.
 */
export function teamSignature(employerName: string, teamName: string | null | undefined): string {
  return teamName ? words(DEFAULT_LANG).signature(employerName, teamName) : employerName;
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

/** Why a team change was refused, in the reader's language. */
export function teamRefusalText(lang: Lang = DEFAULT_LANG): Record<TeamRefusal, string> {
  return words(lang).refusal;
}

/** Admins first, then by when they joined (the founder's join time is when the business was opened). */
export function sortTeam(members: TeamMember[]): TeamMember[] {
  return [...members].sort(
    (a, b) =>
      (a.role === b.role ? 0 : a.role === "admin" ? -1 : 1) ||
      (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "") ||
      a.email.localeCompare(b.email),
  );
}
