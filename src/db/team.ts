// 雇主多人管理 (#87, PRD R-38, ADR 0012): a business's team and its invitations. Every change is checked with the
// rules in src/components/employer/team.ts inside the transaction that writes it. Server only.
import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { guardedBatch } from "@/db/guarded-batch";
import { unchangedMembership, unchangedTeam } from "@/db/team-state";
import { insertIf, nextIdSql } from "@/db/write-if";
import { CHANGED, untilSettled } from "@/db/optimistic";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import {
  INVITES_PER_DAY,
  TEAM_MAX,
  checkTeamChange,
  inviteExpired,
  linkExpired,
  sortTeam,
  teamFull,
  type TeamChange,
  type TeamMember,
  type TeamRefusal,
  type TeamRole,
} from "@/components/employer/team";

export type Reader = Awaited<ReturnType<typeof database>>;

export type TeamInvite = typeof t.teamInvites.$inferSelect;

export async function membersOf(db: Reader, employerId: string): Promise<TeamMember[]> {
  const rows = await db
    .select({
      email: t.accounts.email,
      role: t.accounts.teamRole,
      name: t.accounts.teamName,
      joinedAt: t.accounts.teamJoinedAt,
    })
    .from(t.accounts)
    .where(eq(t.accounts.employerId, employerId));
  return sortTeam(rows.map((r) => ({ ...r, role: r.role ?? "admin" })));
}

/** The business's open invitation links not expired yet (#349): each holds a place in the team, as an invitation. */
export async function liveLinkCount(db: Reader, employerId: string, now: Date): Promise<number> {
  const rows = await db
    .select({ createdAt: t.teamInviteLinks.createdAt })
    .from(t.teamInviteLinks)
    .where(and(eq(t.teamInviteLinks.employerId, employerId), eq(t.teamInviteLinks.status, "open")));
  return rows.filter((r) => !linkExpired(r.createdAt, now.getTime())).length;
}

/** Invitations sent and links made by the business in the 24 hours before `now` (#197, #349). */
export async function sentInLastDay(db: Reader, employerId: string, now: Date): Promise<number> {
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const [{ invites }] = await db
    .select({ invites: sql<number>`count(*)` })
    .from(t.teamInvites)
    .where(and(eq(t.teamInvites.employerId, employerId), gt(t.teamInvites.createdAt, dayAgo)));
  const [{ links }] = await db
    .select({ links: sql<number>`count(*)` })
    .from(t.teamInviteLinks)
    .where(and(eq(t.teamInviteLinks.employerId, employerId), gt(t.teamInviteLinks.createdAt, dayAgo)));
  return Number(invites) + Number(links);
}

/** Everyone working for the business, admins first. */
export async function getTeam(employerId: string): Promise<TeamMember[]> {
  return membersOf(await database(), employerId);
}

export type InviteResult =
  | { status: "invited"; invite: TeamInvite }
  | { status: "no_account" } // nobody has signed up with this email yet
  | { status: "member" } // already in this team
  | { status: "has_business" } // works for another business
  | { status: "pending" } // already invited and not answered yet
  | { status: "full" }
  | { status: "too_many" } // INVITES_PER_DAY sent in the last 24 hours (#197)
  | { status: TeamRefusal };

/** An admin invites an existing account that has no business yet. */
export async function inviteToTeam(
  employerId: string,
  byEmail: string,
  email: string,
  role: TeamRole,
  now = new Date(),
): Promise<InviteResult> {
  const address = normalizeEmail(email);
  const db = await database();
  return untilSettled<InviteResult>(
    async () => {
      const unchanged = await unchangedTeam(db, employerId, address);
      const members = await membersOf(db, employerId);
      const me = members.find((m) => m.email === normalizeEmail(byEmail));
      if (!me) return { status: "not_member" };
      if (me.role !== "admin") return { status: "not_admin" };
      if (members.some((m) => m.email === address)) return { status: "member" };
      const [account] = await db.select().from(t.accounts).where(eq(t.accounts.email, address));
      if (!account) return { status: "no_account" };
      if (account.employerId) return { status: "has_business" };
      const waiting = await db
        .select({ id: t.teamInvites.id, email: t.teamInvites.email, createdAt: t.teamInvites.createdAt })
        .from(t.teamInvites)
        .where(and(eq(t.teamInvites.employerId, employerId), eq(t.teamInvites.status, "pending")));
      // Expired invitations (#194) hold no place; one to the same person is replaced by the new one.
      const pending = waiting.filter((p) => !inviteExpired(p.createdAt, now.getTime()));
      if (pending.some((p) => p.email === address)) return { status: "pending" };
      if (teamFull(members.length, pending.length + (await liveLinkCount(db, employerId, now))))
        return { status: "full" };
      if ((await sentInLastDay(db, employerId, now)) >= INVITES_PER_DAY) return { status: "too_many" };
      const createdAt = now.toISOString();
      const { applied, results } = await guardedBatch(db, unchanged, (allowed) => [
        db
          .update(t.teamInvites)
          .set({ status: "cancelled", answeredAt: createdAt })
          .where(
            and(
              eq(t.teamInvites.employerId, employerId),
              eq(t.teamInvites.email, address),
              eq(t.teamInvites.status, "pending"),
              allowed,
            ),
          ),
        insertIf(
          db,
          t.teamInvites,
          {
            id: nextIdSql(t.teamInvites, t.teamInvites.id, "ti"),
            employerId,
            email: address,
            role,
            invitedByEmail: me.email,
            createdAt,
            status: "pending",
            answeredAt: null,
          },
          allowed,
        ).returning(),
      ]);
      return applied ? { status: "invited", invite: results[1][0] } : CHANGED;
    },
    () => ({ status: "busy" }),
  );
}

/** The business's invitations nobody has answered yet, newest first; `expired` after 14 days (#194). */
export async function pendingInvitesOf(
  employerId: string,
  now = new Date(),
): Promise<(TeamInvite & { expired: boolean })[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.teamInvites)
    .where(and(eq(t.teamInvites.employerId, employerId), eq(t.teamInvites.status, "pending")))
    .orderBy(desc(t.teamInvites.createdAt));
  return rows.map((row) => ({ ...row, expired: inviteExpired(row.createdAt, now.getTime()) }));
}

export type InviteForMe = TeamInvite & { employerName: string };

/**
 * Invitations waiting for this account, oldest first, with the business's name. Banned businesses and expired
 * invitations (#194) are left out.
 */
export async function invitesFor(email: string, now = new Date()): Promise<InviteForMe[]> {
  const db = await database();
  const rows = await db
    .select({ invite: t.teamInvites, employerName: t.employers.name })
    .from(t.teamInvites)
    .innerJoin(t.employers, eq(t.employers.id, t.teamInvites.employerId))
    .where(
      and(
        eq(t.teamInvites.email, normalizeEmail(email)),
        eq(t.teamInvites.status, "pending"),
        isNull(t.employers.bannedAt),
      ),
    )
    .orderBy(asc(t.teamInvites.createdAt));
  return rows
    .filter((r) => !inviteExpired(r.invite.createdAt, now.getTime()))
    .map((r) => ({ ...r.invite, employerName: r.employerName }));
}

export type AnswerResult =
  | { status: "busy" }
  | { status: "accepted"; employerId: string }
  | { status: "declined" }
  | { status: "gone" } // not pending any more (cancelled, answered) or not this account's
  | { status: "has_business" }
  | { status: "full" };

/**
 * The invited account accepts (with the name the team will see) or declines. Accepting joins the team with the
 * invited role; other invitations to the account stay pending until it answers them (it cannot accept two).
 */
export async function answerInvite(
  email: string,
  inviteId: string,
  answer: { accept: true; name: string } | { accept: false },
  now = new Date(),
): Promise<AnswerResult> {
  const address = normalizeEmail(email);
  const db = await database();
  return untilSettled<AnswerResult>(
    async () => {
      const [locator] = await db
        .select({ employerId: t.teamInvites.employerId })
        .from(t.teamInvites)
        .where(and(eq(t.teamInvites.id, inviteId), eq(t.teamInvites.email, address)));
      if (!locator) return { status: "gone" };
      const unchanged = await unchangedTeam(db, locator.employerId, address);
      const [invite] = await db
        .select({ invite: t.teamInvites, bannedAt: t.employers.bannedAt })
        .from(t.teamInvites)
        .innerJoin(t.employers, eq(t.employers.id, t.teamInvites.employerId))
        .where(and(eq(t.teamInvites.id, inviteId), eq(t.teamInvites.email, address)));
      if (!invite || invite.invite.status !== "pending" || invite.bannedAt) return { status: "gone" };
      if (inviteExpired(invite.invite.createdAt, now.getTime())) return { status: "gone" };
      const answeredAt = now.toISOString();
      if (!answer.accept) {
        const [declined] = await db
          .update(t.teamInvites)
          .set({ status: "declined", answeredAt })
          .where(and(eq(t.teamInvites.id, inviteId), unchanged))
          .returning();
        return declined ? { status: "declined" } : CHANGED;
      }
      const [account] = await db.select().from(t.accounts).where(eq(t.accounts.email, address));
      if (!account || account.employerId) return { status: "has_business" };
      const { employerId, role } = invite.invite;
      if ((await membersOf(db, employerId)).length >= TEAM_MAX) return { status: "full" };
      const { applied } = await guardedBatch(db, unchanged, (allowed) => [
        db
          .update(t.accounts)
          .set({ employerId, teamRole: role, teamName: answer.name, teamJoinedAt: answeredAt })
          .where(and(eq(t.accounts.email, address), allowed)),
        db
          .update(t.teamInvites)
          .set({ status: "accepted", answeredAt })
          .where(and(eq(t.teamInvites.id, inviteId), allowed)),
      ]);
      return applied ? { status: "accepted", employerId } : CHANGED;
    },
    () => ({ status: "busy" }),
  );
}

/** An admin takes back an invitation that has not been answered. */
export async function cancelInvite(
  employerId: string,
  byEmail: string,
  inviteId: string,
  now = new Date(),
): Promise<{ status: "cancelled" | "gone" | TeamRefusal }> {
  const db = await database();
  return untilSettled<{ status: "cancelled" | "gone" | TeamRefusal }>(
    async () => {
      const unchanged = await unchangedTeam(db, employerId);
      const me = (await membersOf(db, employerId)).find((m) => m.email === normalizeEmail(byEmail));
      if (!me) return { status: "not_member" };
      if (me.role !== "admin") return { status: "not_admin" };
      const [invite] = await db
        .select()
        .from(t.teamInvites)
        .where(and(eq(t.teamInvites.id, inviteId), eq(t.teamInvites.employerId, employerId)));
      if (!invite || invite.status !== "pending") return { status: "gone" };
      const [cancelled] = await db
        .update(t.teamInvites)
        .set({ status: "cancelled", answeredAt: now.toISOString() })
        .where(and(eq(t.teamInvites.id, inviteId), unchanged))
        .returning();
      return cancelled ? { status: "cancelled" } : CHANGED;
    },
    () => ({ status: "busy" }),
  );
}

/** Changes a role, removes someone, or lets the signed-in person leave; a team always keeps an admin. */
export async function changeTeam(
  employerId: string,
  byEmail: string,
  change: TeamChange,
): Promise<{ status: "done" } | { status: TeamRefusal }> {
  const actor = normalizeEmail(byEmail);
  const db = await database();
  return untilSettled<{ status: "done" | TeamRefusal }>(
    async () => {
      const unchanged = await unchangedMembership(db, employerId);
      const members = await membersOf(db, employerId);
      const normalized: TeamChange =
        change.type === "leave" ? change : { ...change, email: normalizeEmail(change.email) };
      const refusal = checkTeamChange(members, actor, normalized);
      if (refusal) return { status: refusal };
      const target = normalized.type === "leave" ? actor : normalized.email;
      const where = and(eq(t.accounts.email, target), eq(t.accounts.employerId, employerId), unchanged);
      const set = normalized.type === "role" ? { teamRole: normalized.role } : LEFT_TEAM;
      const [changed] = await db.update(t.accounts).set(set).where(where).returning({ email: t.accounts.email });
      return changed ? { status: "done" } : CHANGED;
    },
    () => ({ status: "busy" }),
  );
}

/** What an account's row looks like once it no longer works for a business. */
export const LEFT_TEAM = { employerId: null, teamRole: null, teamName: null, teamJoinedAt: null } as const;

/** The name this person goes by in the team's chats. */
export async function setTeamName(email: string, name: string): Promise<void> {
  const db = await database();
  await db
    .update(t.accounts)
    .set({ teamName: name })
    .where(eq(t.accounts.email, normalizeEmail(email)));
}
