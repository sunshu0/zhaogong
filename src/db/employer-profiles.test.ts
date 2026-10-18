import { describe, expect, it } from "vitest";
import { getEmployerPage, listPublicEmployerPages, saveEmployerPage } from "@/db/employer-profiles";
import { answerInvite, changeTeam, inviteToTeam } from "@/db/team";
import { deleteAccount } from "@/db/account-data";
import { banEmployer, createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

const T0 = new Date("2026-10-18T03:00:00.000Z");
let n = 0;

/** A business opened by its admin, and a second account that joined it as a member. */
async function shop() {
  n += 1;
  const boss = `pages.boss${n}@example.com`;
  const staff = `pages.staff${n}@example.com`;
  await ensureAccount(boss);
  await ensureAccount(staff);
  const employer = await createEmployer({ name: `企业主页店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  const invited = await inviteToTeam(employer.id, boss, staff, "member", T0);
  if (invited.status !== "invited") throw new Error(invited.status);
  await answerInvite(staff, invited.invite.id, { accept: true, name: "小李" }, T0);
  return { boss, staff, employer };
}

describe("saveEmployerPage (ADR 0022)", () => {
  it("lets the business's admin replace the page, and records who and when", async () => {
    const { boss, employer } = await shop();
    expect(await saveEmployerPage(boss, { bio: "第一版" }, T0)).toMatchObject({ page: { bio: "第一版" } });
    const later = new Date("2026-10-18T04:00:00.000Z");
    await saveEmployerPage(` ${boss.toUpperCase()} `, { headline: "招前厅" }, later);
    expect(await getEmployerPage(employer.id)).toEqual({
      employerId: employer.id,
      page: { headline: "招前厅" },
      updatedAt: later.toISOString(),
      updatedByEmail: boss,
    });
  });

  it("refuses a member, and an account without a business", async () => {
    const { staff, employer } = await shop();
    expect(await saveEmployerPage(staff, { bio: "成员写的" }, T0)).toBe("not_admin");
    expect(await getEmployerPage(employer.id)).toBeUndefined();
    await ensureAccount("pages.nobody@example.com");
    expect(await saveEmployerPage("pages.nobody@example.com", { bio: "x" }, T0)).toBe("no_business");
  });

  it("follows the team: a member made admin may save", async () => {
    const { boss, staff, employer } = await shop();
    await changeTeam(employer.id, boss, { type: "role", email: staff, role: "admin" });
    expect(await saveEmployerPage(staff, { bio: "新管理员写的" }, T0)).toMatchObject({ updatedByEmail: staff });
  });

  it("keeps the page when the one who saved it deletes the account while the team carries on", async () => {
    const { boss, staff, employer } = await shop();
    await changeTeam(employer.id, boss, { type: "role", email: staff, role: "admin" });
    await saveEmployerPage(boss, { bio: "老板写的" }, T0);
    expect(await deleteAccount(boss)).toBe("deleted");
    expect(await getEmployerPage(employer.id)).toMatchObject({
      page: { bio: "老板写的" },
      updatedByEmail: DELETED_ACCOUNT,
    });
  });
});

describe("listPublicEmployerPages", () => {
  it("has the businesses that have a page, with their names, and not banned ones", async () => {
    const one = await shop();
    const two = await shop();
    const three = await shop();
    await saveEmployerPage(one.boss, { bio: "一号" }, T0);
    await saveEmployerPage(three.boss, { bio: "三号" }, T0);
    await banEmployer(three.employer.id);
    expect(await listPublicEmployerPages([one.employer.id, two.employer.id, three.employer.id])).toEqual([
      { employerId: one.employer.id, businessName: one.employer.name, page: { bio: "一号" } },
    ]);
    expect(await listPublicEmployerPages([])).toEqual([]);
  });
});
