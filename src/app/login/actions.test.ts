import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountEmployer, listEmployers } from "@/lib/data";
import { SESSION_COOKIE, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { accountStatus, openEmployerForAccount, requestSignInCode, signInAccount, signOutAccount, switchIdentity } =
  await import("@/app/login/actions");

/** The whole sign-in, as the page does it: ask for a code, then send it back. */
async function signIn(email: string, role: "seeker" | "employer" = "seeker") {
  const sent = await requestSignInCode(email);
  if (!sent.ok || !sent.devCode) throw new Error("no code");
  return signInAccount(email, sent.devCode, role);
}

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("注册或登录", () => {
  it("sends a code (shown on the page outside production), at most once a minute, and refuses a bad email", async () => {
    expect(await requestSignInCode("nope")).toEqual({ ok: false, error: "请输入正确的邮箱地址" });
    expect(await requestSignInCode("New@Example.com")).toEqual({ ok: true, devCode: expect.stringMatching(/^\d{6}$/) });
    expect(await requestSignInCode("new@example.com")).toEqual({
      ok: false,
      error: expect.stringMatching(/^验证码刚发过，请 \d+ 秒后再获取$/),
    });
  });

  it("in production never hands the code to the page (no mail service yet: it refuses instead)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "production secret");
    const result = await requestSignInCode("prod@example.com");
    expect(result).toEqual({ ok: false, error: "邮件服务还没有配置，暂时无法发送验证码" });
    expect(result).not.toHaveProperty("devCode");
    expect(console.info).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("creates the account on first sign-in and starts a server session in the cookie", async () => {
    expect(await accountStatus()).toBeNull();
    expect(await signIn(" New.Person@Example.com ")).toEqual({
      ok: true,
      account: { email: "new.person@example.com", activeRole: "seeker" },
    });
    expect(cookies.get(SESSION_COOKIE)).toMatch(/^[\w-]{43}$/);
    expect(await accountStatus()).toEqual({ email: "new.person@example.com", activeRole: "seeker" });
    expect(await accountStatus("new.person@example.com")).toEqual({
      email: "new.person@example.com",
      activeRole: "seeker",
    });
  });

  it("refuses a wrong code with the tries left, a code never sent, and a malformed one", async () => {
    const sent = (await requestSignInCode("li@example.com")) as { devCode: string };
    const wrong = sent.devCode === "000000" ? "111111" : "000000";
    expect(await signInAccount("li@example.com", wrong)).toEqual({ ok: false, error: "验证码不对，还可以再试 4 次" });
    expect(await signInAccount("li@example.com", "12345")).toEqual({ ok: false, error: "请输入 6 位数字验证码" });
    expect(await signInAccount("never@example.com", "123456")).toEqual({ ok: false, error: "请先获取验证码" });
    expect(await accountStatus()).toBeNull();
  });

  it("knows only the browser's own session: another email asked about reads as signed out", async () => {
    await signIn("me@example.com");
    expect(await accountStatus("someone.else@example.com")).toBeNull();
  });

  it("signs out on the server: the cookie and the session are gone", async () => {
    await signIn("leaving@example.com");
    await signOutAccount();
    expect(cookies.has(SESSION_COOKIE)).toBe(false);
    expect(await accountStatus()).toBeNull();
  });
});

describe("openEmployerForAccount", () => {
  it("needs a signed-in session for that email", async () => {
    expect(await openEmployerForAccount("boss@example.com", { kind: "existing", employerId: "e4" })).toEqual({
      ok: false,
      error: "请先登录",
    });
    await signIn("boss@example.com");
    expect(await openEmployerForAccount("other@example.com", { kind: "existing", employerId: "e4" })).toEqual({
      ok: false,
      error: "请先登录",
    });
  });

  it("claims a demo business and switches the session to it", async () => {
    await signIn("boss.one@example.com", "employer");
    expect(await accountStatus()).toEqual({ email: "boss.one@example.com", activeRole: "seeker" }); // no business yet
    const result = await openEmployerForAccount("boss.one@example.com", { kind: "existing", employerId: "e4" });
    expect(result).toEqual({ ok: true, employer: { id: "e4", name: "悦美发型工作室" } });
    expect(await accountStatus()).toEqual({
      email: "boss.one@example.com",
      activeRole: "employer",
      employer: { id: "e4", name: "悦美发型工作室" },
    });
  });

  it("lets one account only claim a business nobody else has", async () => {
    await signIn("first@example.com");
    expect((await openEmployerForAccount("first@example.com", { kind: "existing", employerId: "e1" })).ok).toBe(true);
    await signIn("second@example.com");
    const second = await openEmployerForAccount("second@example.com", { kind: "existing", employerId: "e1" });
    expect(second).toEqual({ ok: false, error: expect.stringContaining("已被其他账号绑定") });
    expect(await getAccountEmployer("second@example.com")).toBeUndefined();
  });

  it("creates a new, unverified business once; an account that has one keeps it", async () => {
    await signIn("new.shop@example.com");
    const before = (await listEmployers()).length;
    const result = await openEmployerForAccount("new.shop@example.com", {
      kind: "new",
      name: " 老王面馆 ",
      regionId: "akl-cbd",
    });
    expect(result.ok).toBe(true);
    expect(await getAccountEmployer("new.shop@example.com")).toMatchObject({
      name: "老王面馆",
      regionId: "akl-cbd",
      verification: "unverified",
    });
    const again = await openEmployerForAccount("new.shop@example.com", {
      kind: "new",
      name: "二号店",
      regionId: "akl-cbd",
    });
    expect(again).toEqual({ ok: true, employer: { id: expect.any(String), name: "老王面馆" } });
    expect((await listEmployers()).length).toBe(before + 1);
  });

  it("refuses non-demo businesses and bad input without creating anything", async () => {
    await signIn("careful@example.com");
    const before = (await listEmployers()).length;
    for (const choice of [
      { kind: "existing", employerId: "e7" },
      { kind: "new", name: "", regionId: "akl-cbd" },
      "e2",
    ]) {
      expect((await openEmployerForAccount("careful@example.com", choice)).ok).toBe(false);
    }
    expect((await listEmployers()).length).toBe(before);
    expect(await getAccountEmployer("careful@example.com")).toBeUndefined();
  });
});

describe("switchIdentity", () => {
  it("switches on the server, and to employer only when the account has a business", async () => {
    expect(await switchIdentity("employer")).toBeNull(); // signed out
    await signIn("two.hats@example.com");
    expect(await switchIdentity("employer")).toEqual({ email: "two.hats@example.com", activeRole: "seeker" });
    await openEmployerForAccount("two.hats@example.com", { kind: "new", name: "两顶帽子", regionId: "akl-cbd" });
    const employer = { id: expect.any(String), name: "两顶帽子" };
    expect(await switchIdentity("seeker")).toEqual({ email: "two.hats@example.com", activeRole: "seeker", employer });
    expect(await switchIdentity("employer")).toEqual({
      email: "two.hats@example.com",
      activeRole: "employer",
      employer,
    });
  });
});
