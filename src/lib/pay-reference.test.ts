import { describe, expect, it } from "vitest";
import { MIN_SAMPLE, belowMedianHint, jobRate, payReference } from "@/lib/pay-reference";
import type { Industry } from "@/lib/types";

let n = 0;
const job = (regionId: string, min: number, max?: number, industry: Industry = "hospitality") => ({
  id: `t${(n += 1)}`,
  country: "NZ" as const,
  industry,
  regionId,
  pay: max == null ? { min } : { min, max },
});

describe("jobRate", () => {
  it("is the middle of a range, or the rate itself", () => {
    expect(jobRate({ min: 24, max: 28 })).toBe(26);
    expect(jobRate({ min: 25 })).toBe(25);
    expect(jobRate({ min: 25, max: 25 })).toBe(25);
  });
});

describe("payReference (#85)", () => {
  it("uses the same industry and region when it has 5 jobs or more", () => {
    const jobs = [
      job("akl-cbd", 24, 26), // 25
      job("akl-cbd", 25), // 25
      job("akl-cbd", 26, 30), // 28
      job("akl-cbd", 23.95), // 23.95
      job("akl-cbd", 30, 35), // 32.5
      job("akl-cbd", 40, 45, "retail"), // another industry
      job("akl-albany", 50), // another region
    ];
    expect(payReference(jobs, { country: "NZ", industry: "hospitality", regionId: "akl-cbd" })).toEqual({
      scope: "region",
      place: "市中心",
      placeEn: "Auckland CBD",
      min: 23.95,
      median: 25,
      max: 35,
      count: 5,
    });
  });

  it("widens to all of Auckland when the region has fewer than 5, and leaves out the job itself", () => {
    const jobs = [job("akl-cbd", 24), job("akl-cbd", 26), job("akl-albany", 28), job("akl-henderson", 30)];
    const own = job("akl-cbd", 99);
    expect(
      payReference([...jobs, own, job("akl-takapuna", 32)], {
        country: "NZ",
        industry: "hospitality",
        regionId: "akl-cbd",
        exclude: own.id,
      }),
    ).toEqual({
      scope: "area",
      place: "全奥克兰",
      placeEn: "All of Auckland",
      min: 24,
      median: 28,
      max: 32,
      count: 5,
    });
  });

  it("gives no reference below 5 jobs, saying how many there are", () => {
    const jobs = Array.from({ length: MIN_SAMPLE - 1 }, (_, i) => job("akl-cbd", 25 + i));
    expect(payReference(jobs, { country: "NZ", industry: "hospitality", regionId: "akl-cbd" })).toEqual({
      scope: "none",
      count: 4,
    });
    expect(payReference([], { country: "NZ", industry: "cleaning" })).toEqual({ scope: "none", count: 0 });
  });

  it("takes the median of an even sample as the middle two's mean", () => {
    const jobs = [24, 25, 26, 27, 28, 29].map((rate) => job("akl-cbd", rate));
    const reference = payReference(jobs, { country: "NZ", industry: "hospitality", regionId: "akl-cbd" });
    expect(reference).toMatchObject({ scope: "region", median: 26.5, count: 6 });
  });
});

describe("belowMedianHint", () => {
  const reference = {
    scope: "region" as const,
    place: "市中心",
    placeEn: "Auckland CBD",
    min: 24,
    median: 26,
    max: 30,
    count: 5,
  };
  it("hints below the median only, and never without a reference or a rate", () => {
    expect(belowMedianHint(25, reference)).toBe("低于同类职位的中位数，可能比较难招到人。");
    expect(belowMedianHint(26, reference)).toBeNull();
    expect(belowMedianHint(undefined, reference)).toBeNull();
    expect(belowMedianHint(20, { scope: "none", count: 2 })).toBeNull();
  });
});
