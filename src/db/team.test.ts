import { describe, expect, it } from "vitest";
import { answerInvite, cancelInvite, changeTeam, getTeam, inviteToTeam, invitesFor, pendingInvitesOf } from "@/db/team";
import {
  banEmployer,
  createEmployer,
  ensureAccount,
  getAccount,
  getAccountEmployer,
  openEmployerIdentity,
} from "@/lib/data";
import { TEAM_MAX } from "@/components/employer/team";
import { deleteAccount, exportAccountData } from "@/db/account-data";
import { createJob, getJob } from "@/lib/data";
import { MOCK_JOBS } from "@/mock/data";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { eq } from "drizzle-orm";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { Job } from "@/lib/types";

function jobFor(employerId: string): Omit<Job, "id"> {
  const job: Partial<Job> = { ...MOCK_JOBS[0] };
  delete job.id;
  return { ...(job as Omit<Job, "id">), employerId, titleZh: "团队测试职位", status: "active" };
}

const T0 = new Date("2026-10-17T02:00:00.000Z");
let n = 0;

/** A new business, opened by its founder, plus `people` accounts that have no business. */
async function shop(people = 1) {
  n += 1;
  const boss = `team.boss${n}@example.com`;
  await ensureAccount(boss);
  const employer = await createEmployer({ name: `团队小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  const others: string[] = [];
  for (let i = 0; i < people; i += 1) {
    const email = `team.staff${n}.${i}@example.com`;
    await ensureAccount(email);
    others.push(email);
  }
  return { boss, employer, others };
}

async function join(employerId: string, boss: string, email: string, role: "admin" | "member" = "member") {
  const invited = await inviteToTeam(employerId, boss, email, role, T0);
  if (invited.status !== "invited") throw new Error(invited.status);
  return answerInvite(email, invited.invite.id, { accept: true, name: "小李" }, T0);
}

describe("team (#87)", () => {
  it("makes whoever opens a business its admin, and a second account can only join by invitation", async () => {
    const { boss, employer, others } = await shop();
    expect(await getTeam(employer.id)).toMatchObject([{ email: boss, role: "admin" }]);
    expect(await openEmployerIdentity(others[0], employer.id)).toEqual({ ok: false, reason: "taken" });
  });

  it("invites an account, which accepts with its name and then posts for the business as a member", async () => {
    const { boss, employer, others } = await shop();
    const [staff] = others;
    const invited = await inviteToTeam(employer.id, boss, `  ${staff.toUpperCase()} `, "member", T0);
    expect(invited).toMatchObject({ status: "invited", invite: { email: staff, status: "pending" } });
    expect(await invitesFor(staff, T0)).toMatchObject([{ employerName: employer.name, invitedByEmail: boss }]);
    expect(await pendingInvitesOf(employer.id)).toHaveLength(1);

    const id = invited.status === "invited" ? invited.invite.id : "";
    expect(await answerInvite(staff, id, { accept: true, name: "小李" }, T0)).toEqual({
      status: "accepted",
      employerId: employer.id,
    });
    expect(await getAccount(staff)).toMatchObject({ employerId: employer.id, teamRole: "member", teamName: "小李" });
    expect((await getAccountEmployer(staff))?.id).toBe(employer.id);
    expect(await getTeam(employer.id)).toMatchObject([
      { email: boss, role: "admin" },
      { email: staff, role: "member", name: "小李", joinedAt: T0.toISOString() },
    ]);
    expect(await invitesFor(staff)).toEqual([]);
    // Answering twice does nothing.
    expect(await answerInvite(staff, id, { accept: false }, T0)).toEqual({ status: "gone" });
  });

  it("refuses invitations that cannot work", async () => {
    const { boss, employer, others } = await shop(2);
    const other = await shop();
    expect(await inviteToTeam(employer.id, boss, "nobody.yet@example.com", "member", T0)).toEqual({
      status: "no_account",
    });
    expect(await inviteToTeam(employer.id, boss, boss, "member", T0)).toEqual({ status: "member" });
    expect(await inviteToTeam(employer.id, boss, other.boss, "member", T0)).toEqual({ status: "has_business" });
    await inviteToTeam(employer.id, boss, others[0], "member", T0);
    expect(await inviteToTeam(employer.id, boss, others[0], "admin", T0)).toEqual({ status: "pending" });
    // Only an admin of this business invites.
    expect(await inviteToTeam(employer.id, other.boss, others[1], "member", T0)).toEqual({ status: "not_member" });
    await join(employer.id, boss, others[1]);
    const third = `team.third${n}@example.com`;
    await ensureAccount(third);
    expect(await inviteToTeam(employer.id, others[1], third, "member", T0)).toEqual({ status: "not_admin" });
  });

  it("caps a team at TEAM_MAX people, counting invitations not answered yet", async () => {
    const { boss, employer, others } = await shop(TEAM_MAX);
    for (const email of others.slice(0, TEAM_MAX - 1)) {
      expect((await inviteToTeam(employer.id, boss, email, "member", T0)).status).toBe("invited");
    }
    expect(await inviteToTeam(employer.id, boss, others[TEAM_MAX - 1], "member", T0)).toEqual({ status: "full" });
  });

  it("lets the invited account decline, and an admin cancel an invitation before it is answered", async () => {
    const { boss, employer, others } = await shop(2);
    const a = await inviteToTeam(employer.id, boss, others[0], "member", T0);
    const b = await inviteToTeam(employer.id, boss, others[1], "member", T0);
    if (a.status !== "invited" || b.status !== "invited") throw new Error("not invited");
    expect(await answerInvite(others[0], a.invite.id, { accept: false }, T0)).toEqual({ status: "declined" });
    expect(await cancelInvite(employer.id, boss, b.invite.id, T0)).toEqual({ status: "cancelled" });
    expect(await answerInvite(others[1], b.invite.id, { accept: true, name: "小王" }, T0)).toEqual({ status: "gone" });
    expect(await getTeam(employer.id)).toHaveLength(1);
    // Someone else's invitation cannot be answered.
    const c = await inviteToTeam(employer.id, boss, others[1], "member", T0);
    if (c.status !== "invited") throw new Error(c.status);
    expect(await answerInvite(others[0], c.invite.id, { accept: true, name: "冒名" }, T0)).toEqual({ status: "gone" });
  });

  it("an account accepts one business: a second invitation then fails, and a banned business's invitations go", async () => {
    const one = await shop(1);
    const two = await shop(0);
    const three = await shop(0);
    const [staff] = one.others;
    const a = await inviteToTeam(one.employer.id, one.boss, staff, "member", T0);
    const b = await inviteToTeam(two.employer.id, two.boss, staff, "member", T0);
    const c = await inviteToTeam(three.employer.id, three.boss, staff, "member", T0);
    if (a.status !== "invited" || b.status !== "invited" || c.status !== "invited") throw new Error("not invited");
    await banEmployer(three.employer.id);
    expect((await invitesFor(staff, T0)).map((i) => i.employerId)).toEqual([one.employer.id, two.employer.id]);
    expect(await answerInvite(staff, c.invite.id, { accept: true, name: "小李" }, T0)).toEqual({ status: "gone" });
    await answerInvite(staff, a.invite.id, { accept: true, name: "小李" }, T0);
    expect(await answerInvite(staff, b.invite.id, { accept: true, name: "小李" }, T0)).toEqual({
      status: "has_business",
    });
  });

  it("promotes, demotes and removes, and never leaves the team without an admin", async () => {
    const { boss, employer, others } = await shop(1);
    const [staff] = others;
    await join(employer.id, boss, staff);
    expect(await changeTeam(employer.id, boss, { type: "leave" })).toEqual({ status: "last_admin" });
    expect(await changeTeam(employer.id, staff, { type: "remove", email: boss })).toEqual({ status: "not_admin" });
    expect(await changeTeam(employer.id, boss, { type: "role", email: staff, role: "admin" })).toEqual({
      status: "done",
    });
    expect(await changeTeam(employer.id, staff, { type: "role", email: boss, role: "member" })).toEqual({
      status: "done",
    });
    expect(await getTeam(employer.id)).toMatchObject([
      { email: staff, role: "admin" },
      { email: boss, role: "member" },
    ]);
    expect(await changeTeam(employer.id, staff, { type: "remove", email: boss })).toEqual({ status: "done" });
    expect(await getAccount(boss)).toEqual(expect.not.objectContaining({ employerId: expect.anything() }));
    expect(await getAccountEmployer(boss)).toBeUndefined();
    expect(await getTeam(employer.id)).toMatchObject([{ email: staff }]);
  });

  it("lets a member leave; the business and its other people stay", async () => {
    const { boss, employer, others } = await shop(1);
    await join(employer.id, boss, others[0]);
    expect(await changeTeam(employer.id, others[0], { type: "leave" })).toEqual({ status: "done" });
    expect(await getTeam(employer.id)).toMatchObject([{ email: boss, role: "admin" }]);
    // Free to be invited again.
    expect((await inviteToTeam(employer.id, boss, others[0], "member", T0)).status).toBe("invited");
  });

  it("deleting a member's account leaves the team; the business's jobs stay up", async () => {
    const { boss, employer, others } = await shop(1);
    await join(employer.id, boss, others[0]);
    const job = await createJob(jobFor(employer.id));
    expect(await deleteAccount(others[0])).toBe("deleted");
    expect(await getTeam(employer.id)).toMatchObject([{ email: boss }]);
    expect(await getJob(job.id)).toMatchObject({ status: "active" });
  });

  it("the last admin cannot delete the account while others are in the team; alone, the jobs come down", async () => {
    const { boss, employer, others } = await shop(2);
    await join(employer.id, boss, others[0]);
    const pending = await inviteToTeam(employer.id, boss, others[1], "member", T0);
    const job = await createJob(jobFor(employer.id));
    expect(await deleteAccount(boss)).toBe("last_team_admin");
    expect(await changeTeam(employer.id, boss, { type: "remove", email: others[0] })).toEqual({ status: "done" });
    expect(await deleteAccount(boss)).toBe("deleted");
    expect(await getJob(job.id)).toMatchObject({ status: "removed" });
    // The invitation nobody answered is cancelled, and no longer names who sent it.
    if (pending.status !== "invited") throw new Error(pending.status);
    expect(await invitesFor(others[1])).toEqual([]);
    const [kept] = (await exportAccountData(others[1]))!.teamInvites;
    expect(kept).toMatchObject({ received: true, status: "cancelled" });
  });

  it("exports the account's place in the team and its invitations; deleting it removes invitations to it", async () => {
    const { boss, employer, others } = await shop(2);
    await join(employer.id, boss, others[0]);
    await inviteToTeam(employer.id, boss, others[1], "admin", T0);
    const data = await exportAccountData(others[0]);
    expect(data?.team).toEqual({ role: "member", name: "小李", joinedAt: T0.toISOString() });
    expect(data?.teamInvites).toMatchObject([{ employerId: employer.id, received: true, status: "accepted" }]);
    expect((await exportAccountData(boss))?.teamInvites).toHaveLength(2);

    expect(await deleteAccount(others[1])).toBe("deleted");
    expect(await pendingInvitesOf(employer.id)).toEqual([]);
    // A second admin can go; who invited whom stays without the email.
    await changeTeam(employer.id, boss, { type: "role", email: others[0], role: "admin" });
    expect(await deleteAccount(boss)).toBe("deleted");
    const db = await database();
    const [row] = await db.select().from(t.teamInvites).where(eq(t.teamInvites.email, others[0]));
    expect(row?.invitedByEmail).toBe(DELETED_ACCOUNT);
  });
});

describe("invitations expire after 14 days (#194)", () => {
  const LATER = new Date(T0.getTime() + 15 * 86_400_000);

  it("can no longer be accepted, and the invited account no longer sees it", async () => {
    const { boss, employer, others } = await shop(1);
    const invited = await inviteToTeam(employer.id, boss, others[0], "member", T0);
    if (invited.status !== "invited") throw new Error(invited.status);
    expect(await invitesFor(others[0], new Date(T0.getTime() + 13 * 86_400_000))).toHaveLength(1);
    expect(await invitesFor(others[0], LATER)).toEqual([]);
    expect(await answerInvite(others[0], invited.invite.id, { accept: true, name: "小李" }, LATER)).toEqual({
      status: "gone",
    });
    expect(await getTeam(employer.id)).toHaveLength(1);
    // The admin still sees it, marked expired, and may take it back.
    expect(await pendingInvitesOf(employer.id, LATER)).toMatchObject([{ email: others[0], expired: true }]);
    expect(await pendingInvitesOf(employer.id, T0)).toMatchObject([{ expired: false }]);
    expect(await cancelInvite(employer.id, boss, invited.invite.id, LATER)).toEqual({ status: "cancelled" });
  });

  it("holds no place in the team, and the same person can be invited again", async () => {
    const { boss, employer, others } = await shop(TEAM_MAX - 1);
    for (const email of others) await inviteToTeam(employer.id, boss, email, "member", T0);
    await ensureAccount("team.late@example.com");
    expect((await inviteToTeam(employer.id, boss, "team.late@example.com", "member", T0)).status).toBe("full");
    expect((await inviteToTeam(employer.id, boss, "team.late@example.com", "member", LATER)).status).toBe("invited");

    const again = await inviteToTeam(employer.id, boss, others[0], "admin", LATER);
    expect(again.status).toBe("invited");
    const waiting = await pendingInvitesOf(employer.id, LATER);
    expect(waiting.filter((i) => i.email === others[0])).toMatchObject([{ role: "admin", expired: false }]);
    if (again.status !== "invited") throw new Error(again.status);
    expect(await answerInvite(others[0], again.invite.id, { accept: true, name: "新管理员" }, LATER)).toMatchObject({
      status: "accepted",
    });
  });
});
