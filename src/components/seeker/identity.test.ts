import { describe, expect, it } from "vitest";
import {
  DEMO_BUSINESS_IDS,
  employerSignUpHref,
  identityLabel,
  openErrorMessage,
  parseBusinessChoice,
  parseRole,
  postJobHref,
  reconcileIdentity,
} from "@/components/seeker/identity";
import type { DemoSession } from "@/components/seeker/session";

const seeker: DemoSession = { email: "a@example.com", signedInAt: "2026-10-12T00:00:00Z", activeRole: "seeker" };
const both: DemoSession = { ...seeker, employerId: "e4", employerName: "悦美发型工作室" };

describe("parseRole", () => {
  it("reads ?role=employer and treats anything else as a job seeker", () => {
    expect(parseRole("employer")).toBe("employer");
    expect(parseRole(["employer", "seeker"])).toBe("employer");
    for (const other of [undefined, "", "seeker", "admin"]) expect(parseRole(other)).toBe("seeker");
  });
});

describe("parseBusinessChoice", () => {
  it("accepts one of the demo businesses", () => {
    expect(DEMO_BUSINESS_IDS).toEqual(["e1", "e2", "e4"]);
    expect(parseBusinessChoice({ kind: "existing", employerId: "e2" }, "NZ")).toEqual({
      ok: true,
      choice: { kind: "existing", employerId: "e2" },
    });
  });

  it("refuses any other existing business, so nobody can take over a real employer", () => {
    for (const id of ["e3", "e7", "", 4]) {
      expect(parseBusinessChoice({ kind: "existing", employerId: id }, "NZ")).toEqual({
        ok: false,
        error: "请选择一家店",
      });
    }
  });

  it("accepts a new business with a name and a known region, trimming the name", () => {
    expect(parseBusinessChoice({ kind: "new", name: "  老王面馆 ", regionId: "akl-cbd" }, "NZ")).toEqual({
      ok: true,
      choice: { kind: "new", name: "老王面馆", regionId: "akl-cbd" },
    });
  });

  it("asks for a name and a region for a new business", () => {
    expect(parseBusinessChoice({ kind: "new", name: " ", regionId: "akl-cbd" }, "NZ")).toEqual({
      ok: false,
      error: "请填写店名",
    });
    expect(parseBusinessChoice({ kind: "new", name: "店".repeat(41), regionId: "akl-cbd" }, "NZ")).toEqual({
      ok: false,
      error: "店名最多 40 个字",
    });
    expect(parseBusinessChoice({ kind: "new", name: "老王面馆", regionId: "akl-nowhere" }, "NZ")).toEqual({
      ok: false,
      error: "请选择地区",
    });
    expect(parseBusinessChoice(null, "NZ")).toEqual({ ok: false, error: "请选择一家店" });
  });
});

describe("where 发布招聘 goes", () => {
  it("straight to posting when the account has an employer identity", () => {
    expect(postJobHref(both)).toBe("/employer/post");
    expect(postJobHref({ ...both, activeRole: "employer" })).toBe("/employer/post");
  });

  it("to the employer sign-up step otherwise, signed in or not", () => {
    expect(postJobHref(seeker)).toBe("/login?role=employer&next=%2Femployer%2Fpost");
    expect(postJobHref(null)).toBe("/login?role=employer&next=%2Femployer%2Fpost");
    expect(employerSignUpHref("/employer/jobs")).toBe("/login?role=employer&next=%2Femployer%2Fjobs");
  });
});

describe("labels and messages", () => {
  it("names the active identity", () => {
    expect(identityLabel(seeker)).toBe("求职者");
    expect(identityLabel(both)).toBe("求职者");
    expect(identityLabel({ ...both, activeRole: "employer" })).toBe("雇主 · 悦美发型工作室");
  });

  it("explains why an employer identity could not be opened", () => {
    expect(openErrorMessage("taken")).toContain("已被其他账号绑定");
    expect(openErrorMessage("banned")).toContain("停用");
    expect(openErrorMessage("no_employer")).toContain("找不到");
    expect(openErrorMessage("already_employer")).toContain("已经");
  });
});

describe("reconcileIdentity", () => {
  const server = { email: "a@example.com", employer: { id: "e4", name: "悦美发型工作室" } };

  it("takes the business from the server and keeps the identity the user chose", () => {
    expect(reconcileIdentity("employer", server)).toEqual({ activeRole: "employer", employer: server.employer });
    expect(reconcileIdentity("seeker", server)).toEqual({ activeRole: "seeker", employer: server.employer });
  });

  it("falls back to job seeker when the server has no business (never opened, banned, or edited in the browser)", () => {
    expect(reconcileIdentity("employer", { email: "a@example.com" })).toEqual({ activeRole: "seeker" });
  });
});
