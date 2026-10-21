// 团队邀请链接 (#349, ADR 0028): an admin makes a link to send outside the site; whoever opens it signs in and joins
// the team as a member. Only the token's SHA-256 is stored, so the link itself exists only in the answer that made it.
// Used once, revocable, expires after LINK_DAYS (read time). Every check runs in the transaction that writes. Joining
// here is an admin's invitation, as answerInvite, not 开通雇主身份 (openEmployerIdentity). Server only.
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { guardedBatch } from "@/db/guarded-batch";
import { unchangedTeam } from "@/db/team-state";
import { insertIf } from "@/db/write-if";
import { CHANGED, untilSettled } from "@/db/optimistic";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { liveLinkCount, membersOf, sentInLastDay } from "@/db/team";
import { normalizeEmail } from "@/components/seeker/session";
import {
  INVITES_PER_DAY,
  TEAM_MAX,
  inviteExpired,
  linkExpired,
  linkExpiresAt,
  teamFull,
  type TeamRefusal,
} from "@/components/employer/team";

/** Where a link leads; the token follows. */
export const JOIN_PATH = "/employer/team/join/";

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type TeamLink = typeof t.teamInviteLinks.$inferSelect;

/** An admin's view of a link not used yet: never the token, which is not stored. */
export interface OpenTeamLink {
  id: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

async function adminOf(db: Parameters<typeof membersOf>[0], employerId: string, byEmail: string) {
  const me = (await membersOf(db, employerId)).find((m) => m.email === normalizeEmail(byEmail));
  if (!me) return "not_member" as const;
  if (me.role !== "admin") return "not_admin" as const;
  return me;
}

export type CreateLinkResult =
  | { status: "created"; id: string; token: string; expiresAt: string }
  | { status: "full" }
  | { status: "too_many" }
  | { status: TeamRefusal };

/** An admin makes a link; its token is in this answer only. */
export async function createTeamLink(employerId: string, byEmail: string, now = new Date()): Promise<CreateLinkResult> {
  const db = await database();
  return untilSettled<CreateLinkResult>(
    async () => {
      const unchanged = await unchangedTeam(db, employerId);
      const me = await adminOf(db, employerId, byEmail);
      if (typeof me === "string") return { status: me };
      const members = await membersOf(db, employerId);
      const invites = await db
        .select({ createdAt: t.teamInvites.createdAt })
        .from(t.teamInvites)
        .where(and(eq(t.teamInvites.employerId, employerId), eq(t.teamInvites.status, "pending")));
      const liveInvites = invites.filter((i) => !inviteExpired(i.createdAt, now.getTime())).length;
      if (teamFull(members.length, liveInvites + (await liveLinkCount(db, employerId, now)))) return { status: "full" };
      if ((await sentInLastDay(db, employerId, now)) >= INVITES_PER_DAY) return { status: "too_many" };
      const token = randomBytes(32).toString("base64url");
      const createdAt = now.toISOString();
      const id = `tl${randomBytes(9).toString("base64url")}`;
      const [created] = await insertIf(
        db,
        t.teamInviteLinks,
        {
          id,
          employerId,
          tokenHash: hashLinkToken(token),
          createdByEmail: me.email,
          createdAt,
          status: "open",
          usedByEmail: null,
          usedAt: null,
        },
        unchanged,
      ).returning();
      return created ? { status: "created", id, token, expiresAt: linkExpiresAt(createdAt) } : CHANGED;
    },
    () => ({ status: "busy" }),
  );
}

/** The business's links nobody has used or revoked, newest first; `expired` ones are listed until revoked. */
export async function openLinksOf(employerId: string, now = new Date()): Promise<OpenTeamLink[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.teamInviteLinks)
    .where(and(eq(t.teamInviteLinks.employerId, employerId), eq(t.teamInviteLinks.status, "open")))
    .orderBy(desc(t.teamInviteLinks.createdAt));
  return rows.map((row) => ({
    id: row.id,
    createdBy: row.createdByEmail,
    createdAt: row.createdAt,
    expiresAt: linkExpiresAt(row.createdAt),
    expired: linkExpired(row.createdAt, now.getTime()),
  }));
}

/** An admin takes back a link that has not been used. */
export async function revokeTeamLink(
  employerId: string,
  byEmail: string,
  linkId: string,
): Promise<{ status: "revoked" | "gone" | TeamRefusal }> {
  const db = await database();
  return untilSettled<{ status: "revoked" | "gone" | TeamRefusal }>(
    async () => {
      const unchanged = await unchangedTeam(db, employerId);
      const me = await adminOf(db, employerId, byEmail);
      if (typeof me === "string") return { status: me };
      const [link] = await db
        .select()
        .from(t.teamInviteLinks)
        .where(and(eq(t.teamInviteLinks.id, linkId), eq(t.teamInviteLinks.employerId, employerId)));
      if (!link || link.status !== "open") return { status: "gone" };
      const [revoked] = await db
        .update(t.teamInviteLinks)
        .set({ status: "revoked" })
        .where(and(eq(t.teamInviteLinks.id, linkId), unchanged))
        .returning();
      return revoked ? { status: "revoked" } : CHANGED;
    },
    () => ({ status: "busy" }),
  );
}

/**
 * What a link is now. `invalid`: no such token (mistyped, changed, or never made); it says nothing about any business.
 * The others name the business, since whoever holds the token was sent it.
 */
export type LinkState =
  | { status: "invalid" }
  | { status: "open" | "expired" | "used" | "revoked" | "banned"; employerId: string; employerName: string };

async function stateOf(
  db: Parameters<typeof membersOf>[0],
  token: string,
  now: Date,
): Promise<{
  state: LinkState;
  link?: TeamLink;
}> {
  if (typeof token !== "string" || !token || token.length > 200) return { state: { status: "invalid" } };
  const [row] = await db
    .select({ link: t.teamInviteLinks, name: t.employers.name, bannedAt: t.employers.bannedAt })
    .from(t.teamInviteLinks)
    .innerJoin(t.employers, eq(t.employers.id, t.teamInviteLinks.employerId))
    .where(eq(t.teamInviteLinks.tokenHash, hashLinkToken(token)));
  if (!row) return { state: { status: "invalid" } };
  const named = { employerId: row.link.employerId, employerName: row.name };
  const status = row.bannedAt
    ? "banned"
    : row.link.status !== "open"
      ? row.link.status
      : linkExpired(row.link.createdAt, now.getTime())
        ? "expired"
        : "open";
  return { state: { status, ...named }, link: row.link };
}

/** What the join page shows for a token. */
export async function teamLinkState(token: string, now = new Date()): Promise<LinkState> {
  return (await stateOf(await database(), token, now)).state;
}

export type JoinResult =
  | { status: "busy" }
  | { status: "joined"; employerId: string }
  | { status: "invalid" | "expired" | "used" | "revoked" | "banned" }
  | { status: "member" } // already in this team
  | { status: "has_business" } // works for another business (or a banned one)
  | { status: "full" };

/** The signed-in account joins the link's team as a member, with the name the team will see. */
export async function joinTeamByLink(
  email: string,
  token: string,
  name: string,
  now = new Date(),
): Promise<JoinResult> {
  const address = normalizeEmail(email);
  const db = await database();
  return untilSettled<JoinResult>(
    async () => {
      const located = await stateOf(db, token, now);
      if (!located.link) return { status: "invalid" };
      const unchanged = await unchangedTeam(db, located.link.employerId, address);
      const { state, link } = await stateOf(db, token, now);
      if (state.status !== "open" || !link) return { status: state.status === "open" ? "invalid" : state.status };
      const [account] = await db.select().from(t.accounts).where(eq(t.accounts.email, address));
      if (!account) return { status: "invalid" };
      if (account.employerId === link.employerId) return { status: "member" };
      if (account.employerId) return { status: "has_business" };
      if ((await membersOf(db, link.employerId)).length >= TEAM_MAX) return { status: "full" };
      const at = now.toISOString();
      const { applied } = await guardedBatch(db, unchanged, (allowed) => [
        db
          .update(t.teamInviteLinks)
          .set({ status: "used", usedByEmail: address, usedAt: at })
          .where(and(eq(t.teamInviteLinks.id, link.id), allowed)),
        db
          .update(t.accounts)
          .set({ employerId: link.employerId, teamRole: "member", teamName: name, teamJoinedAt: at })
          .where(and(eq(t.accounts.email, address), allowed)),
      ]);
      return applied ? { status: "joined", employerId: link.employerId } : CHANGED;
    },
    () => ({ status: "busy" }),
  );
}

/** Development and browser tests only (/api/dev/team-link-age): the business's link, `days` days older. */
export async function ageTeamLink(employerId: string, token: string, days: number): Promise<boolean> {
  const db = await database();
  const [link] = await db
    .select()
    .from(t.teamInviteLinks)
    .where(and(eq(t.teamInviteLinks.tokenHash, hashLinkToken(token)), eq(t.teamInviteLinks.employerId, employerId)));
  if (!link) return false;
  const createdAt = new Date(Date.parse(link.createdAt) - days * 86_400_000).toISOString();
  await db.update(t.teamInviteLinks).set({ createdAt }).where(eq(t.teamInviteLinks.id, link.id));
  return true;
}
