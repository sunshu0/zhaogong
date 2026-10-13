import { describe, expect, it } from "vitest";
import { MOCK_JOBS } from "@/mock/data";
import { EMPTY_RESUME, matchCandidate, parseResume, rankCandidates, type Candidate } from "@/lib/candidate-matching";

const candidate: Candidate = {
  id: "demo",
  source: "demo",
  name: "林晓",
  headline: "前厅服务员",
  location: "Mt Eden",
  languages: "普通话、英语",
  availability: "周末晚班",
  bio: "负责点餐、上菜和收银。",
  resume: {
    ...EMPTY_RESUME,
    discoverable: true,
    skills: "点餐、上菜、收银",
    experienceYears: 3,
    employmentTypes: ["part_time", "casual"],
    regionIds: ["akl-mt-eden"],
    hoursPerWeek: { min: 15, max: 25 },
    expectedMinPay: 25,
  },
};

describe("candidate matching", () => {
  it("explains a strong match using the same resume and job facts", () => {
    const result = matchCandidate(candidate, MOCK_JOBS[0]);
    expect(result.score).toBe(100);
    expect(result.factors.find((item) => item.key === "skills")?.evidence).toContain("收银");
    expect(result.factors.find((item) => item.key === "experience")?.status).toBe("not_required");
  });

  it("supports several job types and distinguishes unknown facts from mismatches", () => {
    const job = { ...MOCK_JOBS[0], employmentType: ["full_time", "casual"] as ("full_time" | "casual")[] };
    expect(matchCandidate(candidate, job).factors.find((item) => item.key === "type")?.status).toBe("matched");
    const result = matchCandidate(
      { ...candidate, languages: "普通话", resume: { ...candidate.resume, hoursPerWeek: undefined } },
      job,
    );
    expect(result.factors.find((item) => item.key === "languages")?.status).toBe("partial");
    expect(result.factors.find((item) => item.key === "hours")?.status).toBe("unknown");
    expect(result.score).toBeLessThan(100);
  });

  it("does not call missing resumes a full match", () => {
    const empty = { ...candidate, headline: "", bio: "", languages: "", resume: EMPTY_RESUME };
    const result = matchCandidate(empty, MOCK_JOBS[0]);
    expect(result.score).toBeNull();
    expect(result.factors.filter((item) => item.status === "unknown").length).toBeGreaterThan(0);
  });

  it("does not award skills or languages explicitly denied in the resume", () => {
    const result = matchCandidate(
      {
        ...candidate,
        bio: "没有收银经验",
        headline: "",
        languages: "普通话，不会英语",
        resume: { ...candidate.resume, skills: "不会点餐，没有上菜经验" },
      },
      MOCK_JOBS[0],
    );
    expect(result.factors.find((item) => item.key === "skills")?.earned).toBe(0);
    expect(result.factors.find((item) => item.key === "languages")?.earned).toBeLessThan(15);
  });

  it("checks stated experience years and does not assume unrelated experience is qualified", () => {
    const job = MOCK_JOBS[2];
    const chef = {
      ...candidate,
      headline: "点心师傅",
      bio: "点心制作",
      resume: { ...candidate.resume, skills: "点心制作", experienceYears: 2 },
    };
    expect(matchCandidate(chef, job).factors.find((item) => item.key === "experience")?.status).toBe("mismatch");
    expect(
      matchCandidate({ ...chef, resume: { ...chef.resume, experienceYears: 3 } }, job).factors.find(
        (item) => item.key === "experience",
      )?.status,
    ).toBe("matched");
    expect(matchCandidate(candidate, job).factors.find((item) => item.key === "experience")?.status).toBe("unknown");
  });

  it("marks conflicting hours, area and pay rather than overlooking them", () => {
    const result = matchCandidate(
      {
        ...candidate,
        resume: {
          ...candidate.resume,
          regionIds: ["akl-albany"],
          hoursPerWeek: { min: 40, max: 45 },
          expectedMinPay: 40,
        },
      },
      MOCK_JOBS[0],
    );
    for (const key of ["region", "hours", "pay"])
      expect(result.factors.find((item) => item.key === key)?.status).toBe("mismatch");
  });

  it("ranks consenting candidates and ignores personal identifiers in the score", () => {
    const changedName = { ...candidate, id: "other", name: "另一个称呼" };
    expect(matchCandidate(changedName, MOCK_JOBS[0]).score).toBe(matchCandidate(candidate, MOCK_JOBS[0]).score);
    const hidden = { ...candidate, id: "private", resume: { ...candidate.resume, discoverable: false } };
    expect(
      rankCandidates([hidden, changedName, candidate], MOCK_JOBS[0]).map((item) => item.candidate.id),
    ).not.toContain("private");
  });

  it("sanitizes malformed preferences and preserves zero years as a known value", () => {
    const parsed = parseResume({
      discoverable: "true",
      experienceYears: 0,
      employmentTypes: ["part_time", "bad", "part_time"],
      regionIds: ["akl-mt-eden", "bad"],
      hoursPerWeek: { min: 40, max: 20 },
      expectedMinPay: -1,
    });
    expect(parsed.discoverable).toBe(false);
    expect(parsed.experienceYears).toBe(0);
    expect(parsed.employmentTypes).toEqual(["part_time"]);
    expect(parsed.regionIds).toEqual(["akl-mt-eden"]);
    expect(parsed.hoursPerWeek).toBeUndefined();
    expect(parsed.expectedMinPay).toBeUndefined();
  });
});
