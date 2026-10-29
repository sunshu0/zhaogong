import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banEmployer, getAccountEmployer, liftTempBan, listEmployers, tempBanEmployer } from "@/lib/data";
import { sessionCookieName, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
// And its headers: CF-Connecting-IP is how Cloudflare says who is asking (the sign-in limits, ADR 0033).
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => requestHeaders }));

const {
  accountStatus,
  businessBanNotice,
  openEmployerForAccount,
  requestSignInCode,
  signInAccount,
  signOutAccount,
  switchIdentity,
} = await import("@/app/[lang]/login/actions");

/** The whole sign-in, as the page does it: ask for a code, then send it back. */
async function signIn(email: string, role: "seeker" | "employer" = "seeker") {
  const sent = await requestSignInCode(email);
  if (!sent.ok || !sent.devCode) throw new Error("no code");
  return signInAccount(email, sent.devCode, role);
}

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
  requestHeaders = new Headers();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("注册或登录", () => {
  it("sends a code (shown on the page outside production), at most once a minute, and refuses a bad email", async () => {
    expect(await requestSignInCode("nope")).toEqual({ ok: false, error: "请输入正确的邮箱地址" });
    // Security review: no longer than an address can be (254), so a huge string never becomes a code row or a mail.
    expect(await requestSignInCode(`${"a".repeat(250)}@x.co`)).toEqual({ ok: false, error: "请输入正确的邮箱地址" });
    expect(await requestSignInCode("x".repeat(100_000))).toEqual({ ok: false, error: "请输入正确的邮箱地址" });
    expect(await requestSignInCode("New@Example.com")).toEqual({
      ok: true,
      devCode: expect.stringMatching(/^\d{6}$/),
      resendInSec: 60, // #184: for the page's countdown
      validMinutes: 10, // how long the code works, said on the page
    });
    const again = await requestSignInCode("new@example.com");
    expect(again).toEqual({
      ok: false,
      error: expect.stringMatching(/^验证码刚发过，请 \d+ 秒后再获取$/),
      retryAfterSec: expect.any(Number),
    });
    if (again.ok) throw new Error("a second code within the minute");
    expect(again.error).toBe(`验证码刚发过，请 ${again.retryAfterSec} 秒后再获取`);
    expect(again.retryAfterSec).toBeGreaterThan(0);
    expect(again.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("stops one network after twenty codes in an hour and says for how long (ADR 0033)", async () => {
    requestHeaders = new Headers({ "CF-Connecting-IP": "203.0.113.7" });
    for (let i = 0; i < 20; i++) expect((await requestSignInCode(`ip${i}@example.com`)).ok).toBe(true);
    expect(await requestSignInCode("ip20@example.com")).toEqual({
      ok: false,
      error: expect.stringMatching(/^这个网络获取或核对验证码太频繁，请 \d+ 分钟后再试$/),
    });
    requestHeaders = new Headers({ "CF-Connecting-IP": "198.51.100.1" });
    expect((await requestSignInCode("ip20@example.com")).ok).toBe(true);
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
    expect(cookies.get(sessionCookieName())).toMatch(/^[\w-]{43}$/);
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

  it("says the site is open only to invited accounts to an address off SIGN_IN_ALLOWLIST, at both steps", async () => {
    vi.stubEnv("SIGN_IN_ALLOWLIST", "boss@example.com");
    const invitedOnly = "这个演示站现在只开放给受邀的账号。职位、企业主页可以直接看。";
    expect(await requestSignInCode("stranger@example.com")).toEqual({ ok: false, error: invitedOnly });
    const early = await requestSignInCode(" Boss@Example.com ");
    expect(early).toMatchObject({ ok: true, devCode: expect.stringMatching(/^\d{6}$/) });
    vi.stubEnv("SIGN_IN_ALLOWLIST", "friend@example.com");
    expect(await signInAccount("boss@example.com", (early as { devCode: string }).devCode)).toEqual({
      ok: false,
      error: invitedOnly,
    });
    expect(await accountStatus()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("knows only the browser's own session: another email asked about reads as signed out", async () => {
    await signIn("me@example.com");
    expect(await accountStatus("someone.else@example.com")).toBeNull();
  });

  it("signs out on the server: the cookie and the session are gone", async () => {
    await signIn("leaving@example.com");
    await signOutAccount();
    expect(cookies.get(sessionCookieName()) ?? "").toBe("");
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
    expect(second).toEqual({ ok: false, error: expect.stringContaining("已经有团队在用了"), reason: "taken" });
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

  it("claims no existing business without the demo data, where e1, e2… are real businesses (#348)", async () => {
    vi.stubEnv("DEMO_DATA", "false");
    try {
      await signIn("no.demo@example.com");
      const before = (await listEmployers()).length;
      expect(await openEmployerForAccount("no.demo@example.com", { kind: "existing", employerId: "e2" })).toEqual({
        ok: false,
        error: "请选择一家店",
      });
      expect(await getAccountEmployer("no.demo@example.com")).toBeUndefined();
      expect((await listEmployers()).length).toBe(before);
      // A new business still opens, 未验证.
      const created = await openEmployerForAccount("no.demo@example.com", {
        kind: "new",
        name: "没有演示数据的店",
        regionId: "akl-cbd",
      });
      expect(created.ok).toBe(true);
      expect(await getAccountEmployer("no.demo@example.com")).toMatchObject({ verification: "unverified" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses a banned demo business (#348)", async () => {
    await banEmployer("e2");
    await signIn("after.ban@example.com");
    const result = await openEmployerForAccount("after.ban@example.com", { kind: "existing", employerId: "e2" });
    expect(result.ok).toBe(false);
    expect(await getAccountEmployer("after.ban@example.com")).toBeUndefined();
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

describe("businessBanNotice (ADR 0044)", () => {
  it("says until when and why while its business is banned for a while, and nothing once that ends", async () => {
    expect(await businessBanNotice()).toBeNull(); // signed out
    await signIn("banned.team@example.com", "employer");
    expect(await businessBanNotice()).toBeNull(); // no business yet
    const opened = await openEmployerForAccount("banned.team@example.com", {
      kind: "new",
      name: "押金餐厅",
      regionId: "akl-cbd",
    });
    if (!opened.ok) throw new Error("no business");
    const id = opened.employer.id;
    expect(await businessBanNotice()).toBeNull(); // not banned

    await tempBanEmployer(id, 7, "电话里要求先交押金");
    expect(await businessBanNotice()).toMatch(/^你的企业被暂时限制到 .+，原因：电话里要求先交押金。/);

    expect(await liftTempBan(id)).toBe(true);
    expect(await businessBanNotice()).toBeNull();

    // One that began eight days ago for seven has run out: nothing was written when it ended.
    await tempBanEmployer(id, 7, "已经过期", Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(await businessBanNotice()).toBeNull();
  });

  it("says the business is stopped when the ban is for good", async () => {
    await signIn("stopped.team@example.com", "employer");
    const opened = await openEmployerForAccount("stopped.team@example.com", {
      kind: "new",
      name: "停用餐厅",
      regionId: "akl-cbd",
    });
    if (!opened.ok) throw new Error("no business");
    await banEmployer(opened.employer.id);
    const notice = await businessBanNotice();
    expect(notice).toBeTruthy();
    expect(notice).not.toMatch(/暂时/);
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

describe("the language at sign-in (Round 20, ADR 0023 §5)", () => {
  it("keeps the browser's for an account that never chose, and stores it on the account", async () => {
    cookies.set("zg_lang", "en");
    const result = await signIn("lang.first@example.com");
    expect(result).toMatchObject({ ok: true });
    expect(result).not.toHaveProperty("reload");
    expect(cookies.get("zg_lang")).toBe("en");
    const { getAccountLang } = await import("@/db/account-lang");
    expect(await getAccountLang("lang.first@example.com")).toBe("en");
  });

  it("brings the account's back on another device, and has the page load again in it", async () => {
    cookies.set("zg_lang", "en");
    await signIn("lang.device@example.com");
    cookies.clear(); // another browser, no cookie: Chinese
    const result = await signIn("lang.device@example.com");
    expect(result).toMatchObject({ ok: true, reload: true });
    expect(cookies.get("zg_lang")).toBe("en");
  });
});

describe("the sign-in funnel's events (#314, ADR 0025)", () => {
  it("records the code sent and the sign-in, new then returning, and never the email", async () => {
    const { database } = await import("@/db/ready");
    const t = await import("@/db/schema");
    const db = await database();
    await db.delete(t.events);
    await signIn("funnel.new@example.com");
    await signIn("funnel.new@example.com");
    const rows = await db.select().from(t.events);
    expect(rows.map((r) => [r.name, r.detail])).toEqual([
      ["signin_code_sent", null],
      ["signin_success", "new"],
      ["signin_code_sent", null],
      ["signin_success", "returning"],
    ]);
    expect(rows.every((r) => r.path === "/login")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("funnel.new");
  });
});

describe("a staff account (ADR 0043)", () => {
  it("says so with the session while /admin is on, admin from the settings, and follows a role taken away", async () => {
    const { grantModerator, revokeModerator } = await import("@/db/moderators");
    vi.stubEnv("ADMIN_ENABLED", "1");
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", "staff.admin@example.com");
    try {
      const signedIn = await signIn("staff.admin@example.com");
      expect(signedIn).toMatchObject({ ok: true, account: { staff: "admin" } });
      expect(await accountStatus()).toMatchObject({ email: "staff.admin@example.com", staff: "admin" });
      expect(await switchIdentity("seeker")).toMatchObject({ staff: "admin" });

      await signIn("staff.mod@example.com");
      expect((await accountStatus())?.staff).toBeUndefined();
      expect(await grantModerator("staff.mod@example.com", "staff.admin@example.com")).toBe("granted");
      expect(await accountStatus()).toMatchObject({ staff: "moderator" });
      // The next answer after the role goes reads the database again.
      expect(await revokeModerator("staff.mod@example.com", "staff.admin@example.com")).toBe("revoked");
      expect((await accountStatus())?.staff).toBeUndefined();

      vi.stubEnv("ADMIN_ENABLED", "");
      expect((await accountStatus())?.staff).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("cannot open an employer identity", async () => {
    vi.stubEnv("ADMIN_ENABLED", "1");
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", "staff.hiring@example.com");
    try {
      await signIn("staff.hiring@example.com");
      expect(await openEmployerForAccount("staff.hiring@example.com", { kind: "existing", employerId: "e4" })).toEqual({
        ok: false,
        error: "审核员账号只用来审核，不能开通雇主身份。",
      });
      expect(await getAccountEmployer("staff.hiring@example.com")).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
