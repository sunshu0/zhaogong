import { describe, expect, it } from "vitest";
import type { Industry } from "@/lib/types";
import { INDUSTRY_TONE, employerIndustry } from "./industry-avatar";

const jobs = (...industries: Industry[]) => industries.map((industry) => ({ industry }));

describe("employerIndustry", () => {
  it("is the industry most of the employer's jobs are in", () => {
    expect(employerIndustry(jobs("retail", "hospitality", "hospitality"))).toBe("hospitality");
  });

  it("on a tie, takes the newest job's industry (jobs come newest first)", () => {
    expect(employerIndustry(jobs("cleaning", "logistics"))).toBe("cleaning");
    expect(employerIndustry(jobs("logistics", "cleaning", "cleaning", "logistics"))).toBe("logistics");
  });

  it("is `other` for an employer with no jobs", () => {
    expect(employerIndustry([])).toBe("other");
  });
});

describe("INDUSTRY_TONE", () => {
  it("gives every industry one of the three backgrounds", () => {
    const all: Industry[] = [
      "hospitality",
      "retail",
      "beauty",
      "construction",
      "cleaning",
      "logistics",
      "driver",
      "office",
      "other",
    ];
    for (const industry of all) expect([1, 2, 3]).toContain(INDUSTRY_TONE[industry]);
  });
});
