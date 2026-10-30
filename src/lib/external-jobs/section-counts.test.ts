import { describe, expect, it } from "vitest";
import { countSections } from "@/lib/external-jobs/section-counts";

type Shown = Parameters<typeof countSections>[0][number];

describe("countSections (user feedback 10-30 #4)", () => {
  it("counts each section from the jobs shown, none when there are none", () => {
    expect(countSections([])).toEqual({ internship: 0, professional: 0 });
    const job = (kind: string) => ({ kind }) as unknown as Shown;
    // A graduate role is an internship's section's; a job that does not say its kind is 专业职位's (sectionOf).
    expect(countSections([job("internship"), job("graduate"), job("professional")])).toEqual({
      internship: 2,
      professional: 1,
    });
    expect(countSections([job("internship")])).toEqual({ internship: 1, professional: 0 });
  });
});
