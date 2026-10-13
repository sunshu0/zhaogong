import { describe, expect, it } from "vitest";
import { accountStatus, openEmployerForAccount, signInAccount } from "@/app/login/actions";
import { getAccountEmployer, listEmployers } from "@/lib/data";

describe("signInAccount", () => {
  it("creates the account on first sign-in (sign-up and sign-in are the same step)", async () => {
    expect(await signInAccount(" New.Person@Example.com ", "123456")).toEqual({
      ok: true,
      account: { email: "new.person@example.com" },
    });
    expect(await accountStatus("new.person@example.com")).toEqual({ email: "new.person@example.com" });
  });

  it("refuses a bad email or code", async () => {
    expect(await signInAccount("nope", "123456")).toEqual({ ok: false, error: "请输入正确的邮箱地址" });
    expect(await signInAccount("a@example.com", "12345")).toEqual({ ok: false, error: "请输入 6 位数字验证码" });
    expect(await accountStatus("nope")).toBeNull();
  });
});

describe("openEmployerForAccount", () => {
  it("claims a demo business, and the account then signs in with it", async () => {
    const result = await openEmployerForAccount("boss.one@example.com", { kind: "existing", employerId: "e4" });
    expect(result).toEqual({ ok: true, employer: { id: "e4", name: "悦美发型工作室" } });
    expect((await getAccountEmployer("boss.one@example.com"))?.id).toBe("e4");
    expect(await signInAccount("boss.one@example.com", "000000")).toEqual({
      ok: true,
      account: { email: "boss.one@example.com", employer: { id: "e4", name: "悦美发型工作室" } },
    });
  });

  it("lets one account only claim a business nobody else has", async () => {
    expect((await openEmployerForAccount("first@example.com", { kind: "existing", employerId: "e1" })).ok).toBe(true);
    const second = await openEmployerForAccount("second@example.com", { kind: "existing", employerId: "e1" });
    expect(second).toEqual({ ok: false, error: expect.stringContaining("已被其他账号绑定") });
    expect(await getAccountEmployer("second@example.com")).toBeUndefined();
  });

  it("creates a new, unverified business with the name and region given", async () => {
    const before = (await listEmployers()).length;
    const result = await openEmployerForAccount("new.shop@example.com", {
      kind: "new",
      name: " 老王面馆 ",
      regionId: "akl-cbd",
    });
    expect(result.ok).toBe(true);
    const employer = await getAccountEmployer("new.shop@example.com");
    expect(employer).toMatchObject({ name: "老王面馆", regionId: "akl-cbd", verification: "unverified" });
    expect((await listEmployers()).length).toBe(before + 1);
  });

  it("does not create a second business for an account that already has one", async () => {
    await openEmployerForAccount("has.one@example.com", { kind: "new", name: "一号店", regionId: "akl-cbd" });
    const before = (await listEmployers()).length;
    const again = await openEmployerForAccount("has.one@example.com", {
      kind: "new",
      name: "二号店",
      regionId: "akl-cbd",
    });
    expect(again).toEqual({ ok: true, employer: { id: expect.any(String), name: "一号店" } });
    expect((await listEmployers()).length).toBe(before);
  });

  it("refuses non-demo businesses and bad input without creating anything", async () => {
    const before = (await listEmployers()).length;
    for (const choice of [
      { kind: "existing", employerId: "e7" },
      { kind: "new", name: "", regionId: "akl-cbd" },
      "e2",
    ]) {
      expect((await openEmployerForAccount("careful@example.com", choice)).ok).toBe(false);
    }
    expect(await openEmployerForAccount("not-an-email", { kind: "existing", employerId: "e2" })).toEqual({
      ok: false,
      error: "请先登录",
    });
    expect((await listEmployers()).length).toBe(before);
    expect(await getAccountEmployer("careful@example.com")).toBeUndefined();
  });
});
