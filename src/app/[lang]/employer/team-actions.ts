"use server";

// 雇主多人管理 (#87, PRD R-38, ADR 0012): the team page for a business's admins and members, and the invited
// account's answer. Who acts comes from the session; the business from that account (getAccountEmployer). Only an
// admin invites, cancels, or changes someone; anyone may set their own name or leave (a team keeps one admin).
import { getCurrentSession, switchRole } from "@/lib/auth";
import { getAccount, getAccountEmployer } from "@/lib/data";
import {
  answerInvite,
  cancelInvite,
  changeTeam,
  getTeam,
  inviteToTeam,
  invitesFor,
  pendingInvitesOf,
  setTeamName,
  type InviteResult,
} from "@/db/team";
import {
  INVITES_PER_DAY,
  TEAM_MAX,
  checkTeamName,
  teamRefusalText,
  type TeamChange,
  type TeamMember,
  type TeamRefusal,
  type TeamRole,
} from "@/components/employer/team";
import { isValidEmail, normalizeEmail } from "@/components/seeker/session";
import { pick } from "@/i18n/messages";
import { employerTeamMessages } from "@/i18n/messages/employer-team";
import { requestLang } from "@/i18n/server";

/** What this request's answers say, in the visitor's language (Round 20, ADR 0023). */
async function words() {
  const lang = await requestLang();
  return { lang, t: pick(employerTeamMessages, lang).teamActions };
}

export type MyTeam = {
  employer: { id: string; name: string };
  me: { email: string; role: TeamRole; name: string | null };
  members: TeamMember[];
  /** Invitations nobody has answered yet, `expired` after 14 days (#194); admins only (empty for members). */
  invites: { id: string; email: string; role: TeamRole; createdAt: string; expired: boolean }[];
};

type Failure = { ok: false; error_zh: string };

async function myBusiness() {
  const session = await getCurrentSession();
  if (!session) return null;
  const employer = await getAccountEmployer(session.email);
  return employer ? { email: session.email, employer } : null;
}

async function noTeam(): Promise<Failure> {
  return { ok: false, error_zh: (await words()).t.noEmployerRole };
}

/** The signed-in account's team, or null without an employer identity. */
export async function getMyTeam(): Promise<MyTeam | null> {
  const mine = await myBusiness();
  if (!mine) return null;
  const members = await getTeam(mine.employer.id);
  const me = members.find((m) => m.email === mine.email);
  if (!me) return null;
  const invites =
    me.role === "admin"
      ? (await pendingInvitesOf(mine.employer.id)).map(({ id, email, role, createdAt, expired }) => ({
          id,
          email,
          role,
          createdAt,
          expired,
        }))
      : [];
  return {
    employer: { id: mine.employer.id, name: mine.employer.name },
    me: { email: me.email, role: me.role, name: me.name },
    members,
    invites,
  };
}

async function inviteErrors(): Promise<Record<Exclude<InviteResult["status"], "invited">, string>> {
  const { lang, t } = await words();
  return {
    no_account: t.invite.no_account,
    member: t.invite.member,
    has_business: t.invite.has_business,
    pending: t.invite.pending,
    full: t.invite.full(TEAM_MAX),
    too_many: t.invite.too_many(INVITES_PER_DAY),
    ...teamRefusalText(lang),
  };
}

export async function inviteTeammate(email: unknown, role: unknown): Promise<{ ok: true } | Failure> {
  const mine = await myBusiness();
  if (!mine) return noTeam();
  const { t } = await words();
  const address = normalizeEmail(String(email ?? ""));
  if (!isValidEmail(address)) return { ok: false, error_zh: t.badEmail };
  const wanted: TeamRole = role === "admin" ? "admin" : "member";
  const result = await inviteToTeam(mine.employer.id, mine.email, address, wanted);
  return result.status === "invited" ? { ok: true } : { ok: false, error_zh: (await inviteErrors())[result.status] };
}

export async function cancelTeamInvite(inviteId: unknown): Promise<{ ok: true } | Failure> {
  const mine = await myBusiness();
  if (!mine) return noTeam();
  const result = await cancelInvite(mine.employer.id, mine.email, String(inviteId ?? ""));
  if (result.status === "cancelled") return { ok: true };
  const { lang, t } = await words();
  return {
    ok: false,
    error_zh: result.status === "gone" ? t.inviteGone : teamRefusalText(lang)[result.status],
  };
}

function parseChange(input: unknown): TeamChange | undefined {
  if (!input || typeof input !== "object") return undefined;
  const { type, email, role } = input as Record<string, unknown>;
  if (type === "leave") return { type };
  if (typeof email !== "string") return undefined;
  if (type === "remove") return { type, email };
  if (type === "role" && (role === "admin" || role === "member")) return { type, email, role };
  return undefined;
}

/**
 * Promotes, demotes or removes a teammate (admins), or leaves the team. Someone who leaves or is removed keeps the
 * account and its job-seeker side; their employer identity closes.
 */
export async function changeMyTeam(input: unknown): Promise<{ ok: true } | Failure> {
  const mine = await myBusiness();
  if (!mine) return noTeam();
  const { lang, t } = await words();
  const change = parseChange(input);
  if (!change) return { ok: false, error_zh: t.unknownChange };
  const result = await changeTeam(mine.employer.id, mine.email, change);
  if (result.status !== "done") return { ok: false, error_zh: teamRefusalText(lang)[result.status as TeamRefusal] };
  if (change.type === "leave") await switchRole("seeker");
  return { ok: true };
}

export async function setMyTeamName(name: unknown): Promise<{ ok: true; name: string } | Failure> {
  const mine = await myBusiness();
  if (!mine) return noTeam();
  const checked = checkTeamName(String(name ?? ""), (await words()).lang);
  if (!checked.ok) return { ok: false, error_zh: checked.error };
  await setTeamName(mine.email, checked.name);
  return { ok: true, name: checked.name };
}

// ---- the invited account ----

export type MyTeamInvite = { id: string; employerName: string; role: TeamRole; createdAt: string };

/** Invitations waiting for the signed-in account (none once it works for a business). */
export async function getMyTeamInvites(): Promise<MyTeamInvite[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  if ((await getAccount(session.email))?.employerId) return [];
  return (await invitesFor(session.email)).map(({ id, employerName, role, createdAt }) => ({
    id,
    employerName,
    role,
    createdAt,
  }));
}

/**
 * Accepts (with the name the team will see) or declines. Accepting opens the employer identity for the business and
 * switches the session to it, as opening a business at sign-up does.
 */
export async function answerTeamInvite(
  inviteId: unknown,
  answer: unknown,
): Promise<{ ok: true; employer?: { id: string; name: string } } | Failure> {
  const { lang, t } = await words();
  const session = await getCurrentSession();
  if (!session) return { ok: false, error_zh: t.signIn };
  const { accept, name } = (answer && typeof answer === "object" ? answer : {}) as Record<string, unknown>;
  const id = String(inviteId ?? "");
  if (accept !== true) {
    const declined = await answerInvite(session.email, id, { accept: false });
    return declined.status === "declined" ? { ok: true } : { ok: false, error_zh: t.inviteGone };
  }
  const checked = checkTeamName(String(name ?? ""), lang);
  if (!checked.ok) return { ok: false, error_zh: checked.error };
  const result = await answerInvite(session.email, id, { accept: true, name: checked.name });
  if (result.status !== "accepted") {
    const error_zh = {
      gone: t.answer.gone,
      has_business: t.answer.has_business,
      full: t.answer.full(TEAM_MAX),
      declined: t.answer.declined,
    }[result.status];
    return { ok: false, error_zh };
  }
  const switched = await switchRole("employer");
  return { ok: true, employer: switched.employer };
}
