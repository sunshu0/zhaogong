import { describe, expect, it } from "vitest";
import { myTeamInviteNotifications } from "@/app/[lang]/employer/team-notifications";
import { inviteToTeam } from "@/db/team";
import { createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";

let n = 0;

/** A new business with its founder, and an account without a business to invite. */
async function shopAndGuest() {
  n += 1;
  const boss = `notify.boss${n}@example.com`;
  const guest = `notify.guest${n}@example.com`;
  await ensureAccount(boss);
  await ensureAccount(guest);
  const employer = await createEmployer({ name: `通知小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  return { boss, guest, employer };
}

describe("team invitation notifications (#278)", () => {
  it("has one per invitation waiting for an answer, newest first, leading to 我的", async () => {
    const a = await shopAndGuest();
    const b = await shopAndGuest();
    const now = Date.now();
    expect((await inviteToTeam(a.employer.id, a.boss, a.guest, "member", new Date(now - 3_600_000))).status).toBe(
      "invited",
    );
    expect((await inviteToTeam(b.employer.id, b.boss, a.guest, "admin", new Date(now - 60_000))).status).toBe(
      "invited",
    );

    const items = await myTeamInviteNotifications(a.guest, now);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title)).toEqual([
      `${b.employer.name} 邀请你加入团队`,
      `${a.employer.name} 邀请你加入团队`,
    ]);
    expect(items[0]).toMatchObject({
      type: "团队",
      unread: true,
      target: { type: "team_invite" },
      detail: expect.stringContaining("加入后做管理员"),
    });
    expect(items[1].detail).toContain("加入后做成员");
    expect(items.every((item) => item.id.startsWith("team-invite:"))).toBe(true);
  });

  it("has nothing for an account that already has a business, or that nobody invited", async () => {
    const { boss, guest } = await shopAndGuest();
    expect(await myTeamInviteNotifications(boss, Date.now())).toEqual([]);
    expect(await myTeamInviteNotifications(guest, Date.now())).toEqual([]);
  });
});
