import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionCookieName, type CookieJar } from "@/lib/auth";
import { getAccount } from "@/lib/data";
import { grantModerator, listModerators, revokeModerator } from "@/db/moderators";
import { DEMO_MODERATOR } from "@/db/seed";

// Server Functions read the request's cookies; here one jar stands in for one browser. Sessions are in the database
// (the default store), as deleting an account deletes them there.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers() }));

const { accountStatus, openEmployerForAccount, requestSignInCode, signInAccount } =
  await import("@/app/[lang]/login/actions");
const { deleteMyAccount, myServerData } = await import("@/app/[lang]/account/actions");

async function signIn(email: string) {
  const sent = await requestSignInCode(email);
  if (!sent.ok || !sent.devCode) throw new Error("no code");
  return signInAccount(email, sent.devCode);
}

beforeEach(() => {
  cookies.clear();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("导出我的数据 (#54)", () => {
  it("gives the signed-in account's server data, and nothing when signed out", async () => {
    expect(await myServerData()).toEqual({ ok: false, error: "请先登录" });
    await signIn("export.action@example.com");
    await openEmployerForAccount("export.action@example.com", { kind: "new", name: "导出小店", regionId: "akl-cbd" });
    const answer = await myServerData();
    expect(answer.ok && answer.data.account.email).toBe("export.action@example.com");
    expect(answer.ok && answer.data.employer?.business.name).toBe("导出小店");
    expect(answer.ok && answer.data.sessions).toHaveLength(1);
  });
});

describe("删除账号 (#54)", () => {
  it("needs the signed-in email typed again, then deletes, signs out, and the email can sign up anew", async () => {
    expect(await deleteMyAccount("leaving@example.com")).toEqual({ ok: false, error: "请先登录" });
    await signIn("leaving@example.com");
    expect(await deleteMyAccount("someone@example.com")).toEqual({
      ok: false,
      error: "输入的邮箱和当前登录的邮箱不一致",
    });
    expect(await deleteMyAccount(" Leaving@Example.com ")).toEqual({ ok: true });
    expect(cookies.get(sessionCookieName()) ?? "").toBe("");
    expect(await accountStatus()).toBeNull();
    expect(await getAccount("leaving@example.com")).toBeUndefined();

    // The code throttle went with the account, so signing up again works at once.
    expect(await signIn("leaving@example.com")).toMatchObject({ ok: true, account: { activeRole: "seeker" } });
    expect((await getAccount("leaving@example.com"))?.employerId).toBeUndefined();
  });

  it("refuses the last moderator", async () => {
    await signIn("only.mod@example.com");
    await grantModerator("only.mod@example.com", null);
    for (const m of await listModerators()) if (m.email !== "only.mod@example.com") await revokeModerator(m.email);
    expect(await deleteMyAccount("only.mod@example.com")).toEqual({
      ok: false,
      error: "你是最后一位审核员。请先在审核后台添加另一位审核员，再删除账号。",
    });
    expect(await accountStatus()).not.toBeNull();
    await grantModerator(DEMO_MODERATOR, null);
  });
});
