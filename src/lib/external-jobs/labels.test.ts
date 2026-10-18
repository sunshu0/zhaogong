import { describe, expect, it } from "vitest";
import { factLines, payLabel, sourceLine } from "@/lib/external-jobs/labels";

const NOT_STATED = "原文未说明";
import { approvalProblem, parseHide, parseNote, parseTakedown } from "@/lib/external-jobs/review";

describe("external job wording (#112, #113)", () => {
  it("lists every fact, and says 原文未说明 for each the posting does not state", () => {
    const lines = factLines({
      field: "electrical",
      kind: null,
      location: "Christchurch, Canterbury, New Zealand",
      city: "christchurch",
      closesAt: null,
      minYears: null,
      degree: null,
      degreeSubjects: [],
      visa: [],
      pay: null,
    });
    expect(lines).toEqual([
      { label: "领域", value: "电子电气" },
      { label: "类型", value: NOT_STATED },
      { label: "地点", value: "基督城（原文：Christchurch, Canterbury, New Zealand）" },
      { label: "截止日期", value: NOT_STATED },
      { label: "经验", value: NOT_STATED },
      { label: "学历", value: NOT_STATED },
      { label: "签证", value: NOT_STATED },
      { label: "薪资", value: NOT_STATED },
    ]);
  });

  it("words stated facts as the posting's statements", () => {
    const lines = factLines({
      field: "software",
      kind: "graduate",
      location: "Auckland",
      city: "auckland",
      closesAt: "2026-11-20T10:59:59.000Z",
      minYears: 3,
      degree: "bachelor",
      degreeSubjects: ["computer_science", "software_engineering"],
      visa: ["work_rights", "no_sponsorship"],
      pay: { minCents: 95_000_00, maxCents: 110_000_00, currency: "NZD", period: "year" },
    });
    expect(Object.fromEntries(lines.map((l) => [l.label, l.value]))).toEqual({
      领域: "软件",
      类型: "毕业生项目",
      地点: "奥克兰（原文：Auckland）",
      截止日期: "2026/11/20",
      经验: "3 年以上",
      学历: "本科 · 计算机科学、软件工程",
      签证: "原文写明：需要有在新西兰工作的权利；原文写明：不提供签证担保",
      薪资: "$95,000–$110,000 NZD 每年",
    });
    expect(payLabel({ minCents: 3000, currency: "NZD", period: "hour" })).toBe("$30 起 NZD 每小时");
    expect(sourceLine("Rocket Lab", "2026-10-16T20:00:00.000Z")).toBe(
      "外部职位 · 来自 Rocket Lab 官网 · 信息取于 10月17日",
    );
  });

  it("checks a moderator's input", () => {
    expect(parseHide("wrong_field", "")).toEqual({ ok: true, value: { reason: "wrong_field", note: "" } });
    expect(parseHide("other", "  ")).toMatchObject({ ok: false });
    expect(parseHide("nonsense", "x")).toMatchObject({ ok: false });
    expect(parseNote(" 试点结束 ")).toEqual({ ok: true, value: "试点结束" });
    expect(parseNote(42)).toMatchObject({ ok: false });
    expect(parseTakedown("hr@example.com", "")).toMatchObject({ ok: false });
    expect(approvalProblem({ removedAt: null, flags: [] }, false)).toBeUndefined();
    expect(approvalProblem({ removedAt: null, flags: ["ethnicity"] }, false)).toMatch(/种族/);
    expect(approvalProblem({ removedAt: null, flags: ["ethnicity"] }, true)).toBeUndefined();
    expect(approvalProblem({ removedAt: "2026-10-17T00:00:00Z", flags: [] }, true)).toMatch(/下架/);
  });
});
