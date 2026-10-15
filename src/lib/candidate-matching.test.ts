import { describe, expect, it } from "vitest";
import { MOCK_JOBS } from "@/mock/data";
import {
  CANDIDATE_FACT_LABELS,
  candidateFacts,
  EMPTY_RESUME,
  keyConcerns,
  LOW_MATCH_SCORE,
  matchCandidate,
  parseResume,
  rankCandidates,
  splitLowMatches,
  type Candidate,
  type CandidateMatch,
} from "@/lib/candidate-matching";

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

describe("the five facts on a recommendation card", () => {
  it("lists availability, area, expected pay, languages and experience, in that order", () => {
    expect(CANDIDATE_FACT_LABELS).toEqual(["可上班时间", "地区", "期望时薪", "语言", "经验"]);
    expect(candidateFacts(candidate)).toEqual([
      { label: "可上班时间", value: "周末晚班 · 每周 15–25 小时" },
      { label: "地区", value: "Mt Eden / Dominion Rd" },
      { label: "期望时薪", value: "$25 起" },
      { label: "语言", value: "普通话、英语" },
      { label: "经验", value: "3 年" },
    ]);
  });

  it("says what is missing instead of leaving gaps", () => {
    const bare = { ...candidate, availability: "", languages: "", location: "", resume: { ...EMPTY_RESUME } };
    expect(candidateFacts(bare).map((f) => f.value)).toEqual(["待补充", "待补充", "待补充", "待补充", "待补充"]);
    expect(candidateFacts({ ...bare, location: "奥克兰 · 北岸" })[1].value).toBe("奥克兰 · 北岸");
    expect(candidateFacts({ ...bare, resume: { ...EMPTY_RESUME, experienceYears: 0 } })[4].value).toBe("无经验");
  });
});

describe("keyConcerns", () => {
  it("keeps the two weightiest concerns, mismatches before partial matches before unknowns", () => {
    const result = matchCandidate(
      {
        ...candidate,
        languages: "",
        resume: {
          ...candidate.resume,
          regionIds: ["akl-albany"],
          expectedMinPay: 99,
          hoursPerWeek: { min: 40, max: 50 },
        },
      },
      MOCK_JOBS[0],
    );
    expect(keyConcerns(result.factors).map((f) => f.key)).toEqual(["region", "hours"]);
  });

  it("is empty when everything known matches", () => {
    expect(keyConcerns(matchCandidate(candidate, MOCK_JOBS[0]).factors)).toEqual([]);
  });
});

describe("splitLowMatches", () => {
  const at = (id: string, score: number | null) => ({ candidate: { ...candidate, id }, score }) as CandidateMatch;

  it("folds scores below 40 away and keeps unknown scores in the list", () => {
    expect(LOW_MATCH_SCORE).toBe(40);
    const { shown, low } = splitLowMatches([at("a", 90), at("b", null), at("c", 39), at("d", 40), at("e", 0)]);
    expect(shown.map((m) => m.candidate.id)).toEqual(["a", "b", "d"]);
    expect(low.map((m) => m.candidate.id)).toEqual(["c", "e"]);
  });
});
