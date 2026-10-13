import { describe, expect, it } from "vitest";
import { buildRegister, searchRegister } from "@/components/employer/business-register";
import { MOCK_EMPLOYERS } from "@/mock/data";

const register = buildRegister(MOCK_EMPLOYERS);

describe("buildRegister", () => {
  it("has an entry for every employer with register details, plus the demo extras, once each", () => {
    const nzbns = register.map((e) => e.nzbn);
    expect(nzbns).toContain("9429000000001"); // 川味小馆, from the employer record
    expect(nzbns).toContain("9429000000004"); // 悦美发型工作室, demo extra
    expect(new Set(nzbns).size).toBe(nzbns.length);
    expect(register.find((e) => e.nzbn === "9429000000001")?.tradingNames).toContain("川味小馆");
  });
});

describe("searchRegister", () => {
  it("finds an exact NZBN, with spaces or dashes", () => {
    expect(searchRegister(register, "9429 0000 0000 4").results.map((e) => e.nzbn)).toEqual(["9429000000004"]);
    expect(searchRegister(register, "9429-000-000-004").results).toHaveLength(1);
  });

  it("explains a number that is not an NZBN", () => {
    expect(searchRegister(register, "12345")).toEqual({ results: [], error_zh: "NZBN 是 13 位数字，请检查一下。" });
  });

  it("finds companies by legal or trading name, any case, at most five", () => {
    expect(searchRegister(register, "悦美").results.map((e) => e.legalName)).toEqual([
      "Demo Yuemei Hair Studio Limited",
    ]);
    expect(searchRegister(register, "sichuan").results.map((e) => e.nzbn)).toEqual(["9429000000001"]);
    expect(searchRegister(register, "demo").results.length).toBe(5);
  });

  it("asks for more than one character and says when nothing matches", () => {
    expect(searchRegister(register, " 店 ").error_zh).toBe("请至少输入两个字。");
    expect(searchRegister(register, "不存在的公司")).toEqual({
      results: [],
      error_zh: "企业登记里没有找到，请换个名称或直接输入 NZBN。",
    });
  });
});
