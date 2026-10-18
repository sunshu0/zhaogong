import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { banEmployer, createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { answerInvite, inviteToTeam } from "@/db/team";
import { getEmployerPage } from "@/db/employer-profiles";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { employerPublicPages, myEmployerPage, saveMyEmployerPage } = await import("@/app/employer/page-actions");

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

async function as<T>(email: string, role: "seeker" | "employer", call: () => Promise<T>): Promise<T> {
  cookies.clear();
  await createSession(email, role, jar);
  return call();
}

let n = 0;
/** A business opened by its admin, with one member who joined as 小李. */
async function team() {
  n += 1;
  const boss = `page.boss${n}@example.com`;
  const staff = `page.staff${n}@example.com`;
  await ensureAccount(boss);
  await ensureAccount(staff);
  const employer = await createEmployer({ name: `主页小店${n}`, regionId: "akl-cbd" });
  await openEmployerIdentity(boss, employer.id);
  const invited = await inviteToTeam(employer.id, boss, staff, "member");
  if (invited.status !== "invited") throw new Error(invited.status);
  await answerInvite(staff, invited.invite.id, { accept: true, name: "小李" });
  return { boss, staff, employer };
}

describe("the business's 企业主页 on the server (ADR 0022)", () => {
  it("is empty until the admin saves; then the whole team and every visitor see the same page", async () => {
    const { boss, staff, employer } = await team();
    expect(await as(boss, "employer", myEmployerPage)).toMatchObject({ page: null, updatedAt: null, canEdit: true });

    const saved = await as(boss, "employer", () =>
      saveMyEmployerPage({ name: "主页小店 · 北岸", bio: "家常菜", privateDetails: { phone: "021 000 0000" } }),
    );
    expect(saved).toMatchObject({ page: { name: "主页小店 · 北岸", bio: "家常菜" }, canEdit: true });
    expect(saved?.updatedAt).toBeTruthy();
    // The person's own 私密交换资料 never reach the server.
    expect(JSON.stringify((await getEmployerPage(employer.id))?.page)).not.toContain("021");

    const theirs = await as(staff, "employer", myEmployerPage);
    expect(theirs).toMatchObject({ page: { name: "主页小店 · 北岸", bio: "家常菜" }, canEdit: false });
    expect(theirs?.admins).toEqual([boss]);
    expect(theirs?.scope).toBe(JSON.stringify([staff, "employer", employer.id]));

    cookies.clear();
    expect((await employerPublicPages([employer.id, "no-such-business"]))[employer.id]).toMatchObject({
      name: "主页小店 · 北岸",
      bio: "家常菜",
      headline: "",
    });
  });

  it("does not let a member change it, and tells the browser so", async () => {
    const { boss, staff, employer } = await team();
    await as(boss, "employer", () => saveMyEmployerPage({ bio: "管理员写的" }));
    const answer = await as(staff, "employer", () => saveMyEmployerPage({ bio: "成员写的" }));
    expect(answer).toMatchObject({ canEdit: false, page: { bio: "管理员写的" } });
    expect((await getEmployerPage(employer.id))?.page).toEqual({ bio: "管理员写的" });
  });

  it("refuses a page with something that cannot be public, and keeps the saved one (#195)", async () => {
    const { boss, employer } = await team();
    await as(boss, "employer", () => saveMyEmployerPage({ bio: "家常菜" }));
    const refused = await as(boss, "employer", () => saveMyEmployerPage({ bio: "加微信 shop_wx_2026，入职交押金" }));
    expect(refused?.refused?.map((f) => f.field)).toEqual(["bio", "bio"]);
    expect(refused?.page).toEqual({ bio: "家常菜" });
    expect((await getEmployerPage(employer.id))?.page).toEqual({ bio: "家常菜" });
    expect(
      (await as(boss, "employer", () => saveMyEmployerPage({ bio: "家常菜，欢迎加入" })))?.refused,
    ).toBeUndefined();
  });

  it("has nothing for a job seeker identity, someone signed out, or something that is not a page", async () => {
    const { boss } = await team();
    expect(await as(boss, "seeker", myEmployerPage)).toBeNull();
    expect(await as(boss, "seeker", () => saveMyEmployerPage({ bio: "x" }))).toBeNull();
    cookies.clear();
    expect(await myEmployerPage()).toBeNull();
    expect(await as(boss, "employer", () => saveMyEmployerPage("page"))).toBeNull();
  });

  it("leaves banned businesses and odd asks out of the public answer", async () => {
    const { boss, employer } = await team();
    await as(boss, "employer", () => saveMyEmployerPage({ bio: "很快就被停用" }));
    await banEmployer(employer.id);
    cookies.clear();
    expect(await employerPublicPages([employer.id])).toEqual({});
    expect(await employerPublicPages("e1")).toEqual({});
    expect(await employerPublicPages([42, null])).toEqual({});
  });
});
