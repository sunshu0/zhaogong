import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "@/db/account-data";
import { database, resetDatabaseForTests } from "@/db/ready";
import * as t from "@/db/schema";
import { answerInvite, changeTeam, getTeam, inviteToTeam } from "@/db/team";
import { createTeamLink, joinTeamByLink } from "@/db/team-links";
import * as teamState from "@/db/team-state";
import { failOn } from "@/db/testing/fail-trigger";
import { createEmployer, ensureAccount, getAccount, openEmployerIdentity } from "@/lib/data";
import { INVITES_PER_DAY, TEAM_MAX } from "@/components/employer/team";

beforeEach(() => resetDatabaseForTests());
afterEach(() => vi.restoreAllMocks());
const NOW = new Date("2026-10-22T00:00:00.000Z");

async function shop() {
  const boss = "batch.boss@example.com";
  await ensureAccount(boss);
  const employer = await createEmployer({ name: "Batch shop", regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  return { boss, id: employer.id };
}

async function invite(id: string, boss: string, email: string, role: "admin" | "member" = "member") {
  await ensureAccount(email);
  const result = await inviteToTeam(id, boss, email, role, NOW);
  if (result.status !== "invited") throw new Error(result.status);
  return result.invite;
}

describe("team batches on both database drivers", () => {
  it("keeps the last admin when two admins demote themselves at once", async () => {
    const { boss, id } = await shop();
    const other = "batch.admin@example.com";
    const row = await invite(id, boss, other, "admin");
    await answerInvite(other, row.id, { accept: true, name: "Other" }, NOW);
    const results = await Promise.all(
      [boss, other].map((email) => changeTeam(id, email, { type: "role", email, role: "member" })),
    );
    expect(results.map((r) => r.status).sort()).toEqual(["done", "last_admin"]);
    expect((await getTeam(id)).filter((m) => m.role === "admin")).toHaveLength(1);
  });

  it("uses one remaining team place across concurrent email invitations and links", async () => {
    const { boss, id } = await shop();
    const db = await database();
    for (let i = 1; i < TEAM_MAX - 1; i++) {
      const email = `member.${i}@example.com`;
      await ensureAccount(email);
      await db.update(t.accounts).set({ employerId: id, teamRole: "member" }).where(eq(t.accounts.email, email));
    }
    const email = "last.place@example.com";
    await ensureAccount(email);
    const results = await Promise.all([createTeamLink(id, boss, NOW), inviteToTeam(id, boss, email, "member", NOW)]);
    expect(results.filter((r) => r.status === "created" || r.status === "invited")).toHaveLength(1);
    expect(results.filter((r) => r.status === "full")).toHaveLength(1);
  });

  it("enforces the shared daily quota when a link and email invitation arrive together", async () => {
    const { boss, id } = await shop();
    const db = await database();
    await ensureAccount("past@example.com");
    for (let i = 0; i < INVITES_PER_DAY - 1; i++)
      await db.insert(t.teamInvites).values({
        id: `ti${i + 1}`,
        employerId: id,
        email: "past@example.com",
        role: "member",
        invitedByEmail: boss,
        createdAt: NOW.toISOString(),
        status: "cancelled",
      });
    const email = "quota@example.com";
    await ensureAccount(email);
    const results = await Promise.all([createTeamLink(id, boss, NOW), inviteToTeam(id, boss, email, "member", NOW)]);
    expect(results.filter((r) => r.status === "created" || r.status === "invited")).toHaveLength(1);
    expect(results.filter((r) => r.status === "too_many")).toHaveLength(1);
  });

  it("uses each link once when two accounts try to join together", async () => {
    const { boss, id } = await shop();
    const link = await createTeamLink(id, boss, NOW);
    if (link.status !== "created") throw new Error(link.status);
    const people = ["link.one@example.com", "link.two@example.com"];
    for (const email of people) await ensureAccount(email);
    const results = await Promise.all(
      people.map((email) => joinTeamByLink(email, link.token, email.split("@")[0], NOW)),
    );
    expect(results.map((r) => r.status).sort()).toEqual(["joined", "used"]);
    expect(await getTeam(id)).toHaveLength(2);
  });

  it("cannot accept invitations from two teams on one account", async () => {
    const { boss, id } = await shop();
    const other = await createEmployer({ name: "Another shop", regionId: "akl-cbd" });
    const otherBoss = "other.boss@example.com";
    await ensureAccount(otherBoss);
    await openEmployerIdentity(otherBoss, other.id);
    const person = "two.invites@example.com";
    const rows = [await invite(id, boss, person), await invite(other.id, otherBoss, person)];
    const results = await Promise.all(
      rows.map((row) => answerInvite(person, row.id, { accept: true, name: "Person" }, NOW)),
    );
    expect(results.map((r) => r.status).sort()).toEqual(["accepted", "has_business"]);
    const db = await database();
    expect(
      (await db.select().from(t.teamInvites).where(eq(t.teamInvites.email, person))).filter(
        (r) => r.status === "accepted",
      ),
    ).toHaveLength(1);
  });

  it("rolls back a link being used when updating the joining account fails", async () => {
    const { boss, id } = await shop();
    const email = "failed.join@example.com";
    await ensureAccount(email);
    const link = await createTeamLink(id, boss, NOW);
    if (link.status !== "created") throw new Error(link.status);
    const db = await database();
    const remove = await failOn(db, "accounts", "UPDATE");
    try {
      await expect(joinTeamByLink(email, link.token, "Name", NOW)).rejects.toThrow();
    } finally {
      await remove();
    }
    expect((await db.select().from(t.teamInviteLinks).where(eq(t.teamInviteLinks.id, link.id)))[0].status).toBe("open");
    expect((await getAccount(email))!.employerId).toBeUndefined();
    expect(await db.select().from(t.writeGuards)).toEqual([]);
  });

  it("rolls back all account deletion writes if the final account delete fails", async () => {
    const { boss, id } = await shop();
    const db = await database();
    const remove = await failOn(db, "accounts", "DELETE");
    try {
      await expect(deleteAccount(boss)).rejects.toThrow();
    } finally {
      await remove();
    }
    expect((await getAccount(boss))!.employerId).toBe(id);
    expect(await getTeam(id)).toHaveLength(1);
    expect(await db.select().from(t.writeGuards)).toEqual([]);
  });

  it("never reuses an existing invitation id after an earlier invitation was deleted", async () => {
    const { boss, id } = await shop();
    const first = await invite(id, boss, "first@example.com");
    const second = await invite(id, boss, "second@example.com");
    const db = await database();
    await db.delete(t.teamInvites).where(eq(t.teamInvites.id, first.id));
    const third = await invite(id, boss, "third@example.com");
    expect(third.id).not.toBe(second.id);
    expect(Number(third.id.slice(2))).toBeGreaterThan(Number(second.id.slice(2)));
  });

  it("retries a changed membership, then succeeds with fresh permissions", async () => {
    const { boss, id } = await shop();
    const unchanged = vi.spyOn(teamState, "unchangedMembership").mockResolvedValueOnce(sql`false`);
    expect(await changeTeam(id, boss, { type: "role", email: boss, role: "admin" })).toEqual({ status: "done" });
    expect(unchanged).toHaveBeenCalledTimes(2);
  });

  it("returns busy only after three failed attempts, without removing anyone", async () => {
    const { boss, id } = await shop();
    const unchanged = vi.spyOn(teamState, "unchangedMembership").mockResolvedValue(sql`false`);
    expect(await changeTeam(id, boss, { type: "role", email: boss, role: "admin" })).toEqual({ status: "busy" });
    expect(unchanged).toHaveBeenCalledTimes(3);
    expect((await getTeam(id))[0].role).toBe("admin");
  });

  it("does not create an invitation or consume a link when all three attempts conflict", async () => {
    const { boss, id } = await shop();
    const email = "busy@example.com";
    const row = await invite(id, boss, email);
    const link = await createTeamLink(id, boss, NOW);
    if (link.status !== "created") throw new Error(link.status);
    const unchanged = vi.spyOn(teamState, "unchangedTeam").mockResolvedValue(sql`false`);
    const attempts = [
      () => inviteToTeam(id, boss, "new@example.com", "member", NOW),
      () => createTeamLink(id, boss, NOW),
      () => answerInvite(email, row.id, { accept: true, name: "Name" }, NOW),
      () => joinTeamByLink(email, link.token, "Name", NOW),
    ];
    await ensureAccount("new@example.com");
    for (const attempt of attempts) {
      unchanged.mockClear();
      expect(await attempt()).toEqual({ status: "busy" });
      expect(unchanged).toHaveBeenCalledTimes(3);
    }
    expect(await getTeam(id)).toHaveLength(1);
    expect(await (await database()).select().from(t.writeGuards)).toEqual([]);
  });
});
