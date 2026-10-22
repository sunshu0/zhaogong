import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  ageTeamLink,
  createTeamLink,
  hashLinkToken,
  joinTeamByLink,
  openLinksOf,
  revokeTeamLink,
  teamLinkState,
} from "@/db/team-links";
import { getTeam, inviteToTeam } from "@/db/team";
import { banEmployer, createEmployer, ensureAccount, getAccount, openEmployerIdentity } from "@/lib/data";
import { INVITES_PER_DAY, LINK_DAYS, TEAM_MAX } from "@/components/employer/team";
import { deleteAccount, exportAccountData } from "@/db/account-data";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

const T0 = new Date("2026-10-20T02:00:00.000Z");
const later = (days: number) => new Date(T0.getTime() + days * 86_400_000);
let n = 0;

/** A new business opened by its founder, and `people` accounts with no business. */
async function shop(people = 1) {
  n += 1;
  const boss = `link.boss${n}@example.com`;
  await ensureAccount(boss);
  const employer = await createEmployer({ name: `链接小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  const others: string[] = [];
  for (let i = 0; i < people; i += 1) {
    const email = `link.staff${n}.${i}@example.com`;
    await ensureAccount(email);
    others.push(email);
  }
  return { boss, employer, others };
}

async function link(employerId: string, boss: string, now = T0) {
  const made = await createTeamLink(employerId, boss, now);
  if (made.status !== "created") throw new Error(made.status);
  return made;
}

describe("team invitation links (#349, ADR 0028)", () => {
  it("makes a 256-bit token, stores only its hash, and lists the link without it", async () => {
    const { boss, employer } = await shop();
    const made = await link(employer.id, boss);
    expect(made.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(made.expiresAt).toBe(later(LINK_DAYS).toISOString());
    const db = await database();
    const [row] = await db.select().from(t.teamInviteLinks).where(eq(t.teamInviteLinks.id, made.id));
    expect(row.tokenHash).toBe(hashLinkToken(made.token));
    expect(JSON.stringify(row)).not.toContain(made.token);
    expect(await openLinksOf(employer.id, T0)).toEqual([
      { id: made.id, createdBy: boss, createdAt: T0.toISOString(), expiresAt: made.expiresAt, expired: false },
    ]);
    expect(await teamLinkState(made.token, T0)).toEqual({
      status: "open",
      employerId: employer.id,
      employerName: employer.name,
    });
  });

  it("lets only an admin make or revoke a link", async () => {
    const { boss, employer, others } = await shop(2);
    const made = await link(employer.id, boss);
    expect(await joinTeamByLink(others[0], made.token, "小李", T0)).toMatchObject({ status: "joined" });
    expect(await createTeamLink(employer.id, others[0], T0)).toEqual({ status: "not_admin" });
    expect(await createTeamLink(employer.id, others[1], T0)).toEqual({ status: "not_member" });
    const second = await link(employer.id, boss);
    expect(await revokeTeamLink(employer.id, others[0], second.id)).toEqual({ status: "not_admin" });
  });

  it("joins a signed-in account with no business as a member, once", async () => {
    const { boss, employer, others } = await shop(2);
    const made = await link(employer.id, boss);
    expect(await joinTeamByLink(others[0], made.token, "小李", later(1))).toEqual({
      status: "joined",
      employerId: employer.id,
    });
    expect(await getAccount(others[0])).toMatchObject({
      employerId: employer.id,
      teamRole: "member",
      teamName: "小李",
    });
    expect(await teamLinkState(made.token, later(1))).toMatchObject({ status: "used" });
    expect(await joinTeamByLink(others[1], made.token, "小王", later(1))).toEqual({ status: "used" });
    // Whoever joined with it is told they are in the team, not that the link is used up.
    expect(await joinTeamByLink(others[0], made.token, "小李", later(1))).toEqual({ status: "member" });
    expect(await openLinksOf(employer.id, later(1))).toEqual([]);
    expect((await getTeam(employer.id)).map((m) => m.email)).toEqual([boss, others[0]]);
  });

  it("says what is wrong: no such token, expired, revoked, banned", async () => {
    const { boss, employer, others } = await shop();
    expect(await teamLinkState("not-a-real-token", T0)).toEqual({ status: "invalid" });
    expect(await joinTeamByLink(others[0], "not-a-real-token", "小李", T0)).toEqual({ status: "invalid" });

    const old = await link(employer.id, boss);
    expect(await teamLinkState(old.token, later(LINK_DAYS))).toMatchObject({ status: "open" });
    expect(await teamLinkState(old.token, new Date(later(LINK_DAYS).getTime() + 1000))).toMatchObject({
      status: "expired",
    });
    expect(await joinTeamByLink(others[0], old.token, "小李", later(LINK_DAYS + 1))).toEqual({ status: "expired" });
    expect((await openLinksOf(employer.id, later(LINK_DAYS + 1)))[0]).toMatchObject({ id: old.id, expired: true });

    const revoked = await link(employer.id, boss);
    expect(await revokeTeamLink(employer.id, boss, revoked.id)).toEqual({ status: "revoked" });
    expect(await revokeTeamLink(employer.id, boss, revoked.id)).toEqual({ status: "gone" });
    expect(await joinTeamByLink(others[0], revoked.token, "小李", T0)).toEqual({ status: "revoked" });

    const fresh = await link(employer.id, boss);
    await banEmployer(employer.id);
    expect(await teamLinkState(fresh.token, T0)).toMatchObject({ status: "banned" });
    expect(await joinTeamByLink(others[0], fresh.token, "小李", T0)).toEqual({ status: "banned" });
    expect((await getAccount(others[0]))?.employerId).toBeFalsy();
  });

  it("refuses an account that works for a business, this one or another, without using the link", async () => {
    const { boss, employer } = await shop();
    const other = await shop();
    const made = await link(employer.id, boss);
    expect(await joinTeamByLink(boss, made.token, "老板", T0)).toEqual({ status: "member" });
    expect(await joinTeamByLink(other.boss, made.token, "老板", T0)).toEqual({ status: "has_business" });
    expect(await teamLinkState(made.token, T0)).toMatchObject({ status: "open" });
  });

  it("revokes only the business's own links", async () => {
    const { boss, employer } = await shop();
    const other = await shop();
    const made = await link(employer.id, boss);
    expect(await revokeTeamLink(other.employer.id, other.boss, made.id)).toEqual({ status: "gone" });
    expect(await teamLinkState(made.token, T0)).toMatchObject({ status: "open" });
  });

  it("counts open links as places in the team, and links and invitations together toward the daily limit", async () => {
    const { boss, employer, others } = await shop(1);
    for (let i = 1; i < TEAM_MAX; i += 1) await link(employer.id, boss);
    expect(await createTeamLink(employer.id, boss, T0)).toEqual({ status: "full" });
    expect(await inviteToTeam(employer.id, boss, others[0], "member", T0)).toEqual({ status: "full" });
    // Expired links hold no place.
    expect(await createTeamLink(employer.id, boss, later(LINK_DAYS + 1))).toMatchObject({ status: "created" });

    const busy = await shop(0);
    for (let i = 0; i < INVITES_PER_DAY; i += 1) {
      const made = await link(busy.employer.id, busy.boss, new Date(T0.getTime() + i));
      await revokeTeamLink(busy.employer.id, busy.boss, made.id);
    }
    expect(await createTeamLink(busy.employer.id, busy.boss, T0)).toEqual({ status: "too_many" });
    expect(await createTeamLink(busy.employer.id, busy.boss, later(2))).toMatchObject({ status: "created" });
  });

  it("still refuses to grow a team past TEAM_MAX when it filled up some other way", async () => {
    const { boss, employer, others } = await shop(TEAM_MAX);
    const made = await link(employer.id, boss);
    // A link holds a place, so only a change outside the rules fills the team behind it; joining checks again.
    const db = await database();
    for (const email of others.slice(0, TEAM_MAX - 1))
      await db
        .update(t.accounts)
        .set({ employerId: employer.id, teamRole: "member", teamJoinedAt: T0.toISOString() })
        .where(eq(t.accounts.email, email));
    expect(await joinTeamByLink(others[TEAM_MAX - 1], made.token, "成员", later(1))).toEqual({ status: "full" });
    expect(await teamLinkState(made.token, later(1))).toMatchObject({ status: "open" });
  });

  it("ages a link for the browser tests (dev only), and only the business's own", async () => {
    const { boss, employer } = await shop();
    const other = await shop();
    const made = await link(employer.id, boss, new Date());
    expect(await ageTeamLink(other.employer.id, made.token, LINK_DAYS + 1)).toBe(false);
    expect(await ageTeamLink(employer.id, made.token, LINK_DAYS + 1)).toBe(true);
    expect(await teamLinkState(made.token)).toMatchObject({ status: "expired" });
  });

  it("exports the links an account made or used, and keeps them without its email when it is deleted", async () => {
    const { boss, employer, others } = await shop(1);
    const used = await link(employer.id, boss);
    await joinTeamByLink(others[0], used.token, "小李", T0);
    const open = await link(employer.id, boss);
    expect((await exportAccountData(others[0]))?.teamLinks).toEqual([
      { employerId: employer.id, made: false, status: "used", createdAt: T0.toISOString(), usedAt: T0.toISOString() },
    ]);
    expect((await exportAccountData(boss))?.teamLinks).toHaveLength(2);

    expect(await deleteAccount(others[0])).toBe("deleted");
    const db = await database();
    const [row] = await db.select().from(t.teamInviteLinks).where(eq(t.teamInviteLinks.id, used.id));
    expect(row.usedByEmail).toBe(DELETED_ACCOUNT);

    // The last person in the team: its open links are revoked with it.
    expect(await deleteAccount(boss)).toBe("deleted");
    expect(await teamLinkState(open.token, T0)).toMatchObject({ status: "revoked" });
    const [made] = await db.select().from(t.teamInviteLinks).where(eq(t.teamInviteLinks.id, open.id));
    expect(made.createdByEmail).toBe(DELETED_ACCOUNT);
  });
});
