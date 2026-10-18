import { describe, expect, it } from "vitest";
import { APPLICANT_FILTERS, applicantFilterCounts, filterApplicants } from "@/components/employer/applicant-filter";

const list = [
  { id: "a", decision: null },
  { id: "b", decision: "fit" as const },
  { id: "c", decision: "unfit" as const },
  { id: "d", decision: null },
  { id: "e", decision: "hired" as const },
];

describe("applicant filter (#192)", () => {
  it("has 全部, 未处理 and the three marks, in that order", () => {
    expect(APPLICANT_FILTERS.map((f) => f.label)).toEqual(["全部", "未处理", "合适", "已录用", "不合适"]);
  });

  it("keeps the list's order under each pill; 未处理 is no mark yet", () => {
    expect(filterApplicants(list, "all").map((a) => a.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(filterApplicants(list, "open").map((a) => a.id)).toEqual(["a", "d"]);
    expect(filterApplicants(list, "fit").map((a) => a.id)).toEqual(["b"]);
    expect(filterApplicants(list, "hired").map((a) => a.id)).toEqual(["e"]);
  });

  it("counts each pill", () => {
    expect(applicantFilterCounts(list)).toEqual({ all: 5, open: 2, fit: 1, hired: 1, unfit: 1 });
    expect(applicantFilterCounts([])).toEqual({ all: 0, open: 0, fit: 0, hired: 0, unfit: 0 });
  });
});
