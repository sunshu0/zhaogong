import { describe, expect, it } from "vitest";
import {
  canApplyFor,
  checklistFor,
  missingChecks,
  parseApplication,
  parseRejection,
  sanitizeChecklist,
} from "@/components/employer/verification";

const business = { kind: "business_verified" as const, legalName: "Demo Ltd", tradingName: "悦美发型工作室" };

describe("the moderator's checklist (#78)", () => {
  it("has the register, the applicant, a phone call and the website; the accredited list only for 认证雇主", () => {
    expect(checklistFor(business).map((i) => i.id)).toEqual(["register", "applicant", "phone", "website"]);
    expect(checklistFor({ ...business, kind: "accredited_employer" }).map((i) => i.id)).toContain("accredited");
    // Every item but the website has somewhere to look it up.
    for (const item of checklistFor({ ...business, kind: "accredited_employer" }))
      if (item.id !== "website") expect(item.links.length).toBeGreaterThan(0);
    expect(checklistFor(business).find((i) => i.id === "phone")?.links[0].href).toContain(
      encodeURIComponent("悦美发型工作室"),
    );
  });

  it("needs every item but the optional one ticked before 通过", () => {
    const items = checklistFor(business);
    const ticked = sanitizeChecklist(
      { register: { done: true }, applicant: { done: true, note: " 董事名单上有 " }, phone: { done: true } },
      items,
    );
    expect(missingChecks(items, ticked)).toEqual([]);
    expect(ticked.applicant).toEqual({ done: true, note: "董事名单上有" });
    expect(ticked.website).toEqual({ done: false });
    const notCalled = sanitizeChecklist({ register: { done: true }, applicant: { done: true } }, items);
    expect(missingChecks(items, notCalled).map((i) => i.id)).toEqual(["phone"]);
  });

  it("keeps only this application's items, and only real ticks", () => {
    const checklist = sanitizeChecklist(
      { accredited: { done: true }, register: { done: "yes" } },
      checklistFor(business),
    );
    expect(checklist).not.toHaveProperty("accredited");
    expect(checklist.register).toEqual({ done: false });
    expect(sanitizeChecklist(null, checklistFor(business)).phone).toEqual({ done: false });
  });
});

describe("rejecting needs a reason and a note (#78)", () => {
  it("refuses either missing", () => {
    expect(parseRejection(undefined, "说明")).toEqual({ ok: false, error_zh: "请选择驳回理由。" });
    expect(parseRejection("made_up", "说明")).toMatchObject({ ok: false });
    expect(parseRejection("phone_unreachable", "   ")).toEqual({
      ok: false,
      error_zh: "请写明驳回的说明，雇主会看到。",
    });
    expect(parseRejection("phone_unreachable", " 打了两次没人接 ")).toEqual({
      ok: true,
      value: { reason: "phone_unreachable", note: "打了两次没人接" },
    });
  });
});

describe("the employer's application (#78)", () => {
  const form = {
    nzbn: "9429 0000 0000 4",
    contactName: "陈美",
    contactRole: "店主",
    companyPhone: "09 555 0104",
  };

  it("needs the company, a name, a role and the company phone; the website is optional", () => {
    expect(parseApplication(form)).toEqual({
      ok: true,
      value: { ...form, nzbn: "9429000000004", kind: "business_verified" },
    });
    expect(
      parseApplication({ ...form, kind: "accredited_employer", website: "https://facebook.com/yuemei" }),
    ).toMatchObject({ ok: true, value: { kind: "accredited_employer", website: "https://facebook.com/yuemei" } });
    expect(parseApplication({ ...form, nzbn: "" })).toMatchObject({ ok: false });
    expect(parseApplication({ ...form, contactName: " " })).toEqual({ ok: false, error_zh: "请填写联系人姓名。" });
    expect(parseApplication({ ...form, contactRole: "" })).toEqual({ ok: false, error_zh: "请填写你在公司的职务。" });
    expect(parseApplication({ ...form, companyPhone: "打电话" })).toMatchObject({ ok: false });
    expect(parseApplication({ ...form, website: "facebook" })).toMatchObject({ ok: false });
  });

  it("only offers a badge the business does not already have", () => {
    expect(canApplyFor("unverified", "business_verified")).toBe(true);
    expect(canApplyFor("business_verified", "business_verified")).toBe(false);
    expect(canApplyFor("business_verified", "accredited_employer")).toBe(true);
    expect(canApplyFor("accredited_employer", "accredited_employer")).toBe(false);
  });
});
