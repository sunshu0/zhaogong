import { describe, expect, it } from "vitest";
import { formatHours, formatPay, jobTags, postedAgoZh } from "@/components/seeker/format";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";

const job = (id: string): Job => MOCK_JOBS.find((j) => j.id === id)!;

describe("formatPay", () => {
  it("shows a range per hour with the country's currency symbol", () => {
    expect(formatPay({ min: 25, max: 27 }, "NZ")).toBe("$25–27/小时");
  });

  it("shows a single rate and keeps cents only when there are any", () => {
    expect(formatPay({ min: 24 }, "NZ")).toBe("$24/小时");
    expect(formatPay({ min: 24.5 }, "NZ")).toBe("$24.50/小时");
    expect(formatPay({ min: 23.95, max: 26 }, "NZ")).toBe("$23.95–26/小时");
  });

  it("treats max equal to min as a single rate", () => {
    expect(formatPay({ min: 26, max: 26 }, "NZ")).toBe("$26/小时");
  });
});

describe("formatHours", () => {
  it("shows weekly hours as a range or a single number", () => {
    expect(formatHours({ min: 15, max: 25 })).toBe("每周 15–25 小时");
    expect(formatHours({ min: 40 })).toBe("每周 40 小时");
  });

  it("returns nothing when hours are not given", () => {
    expect(formatHours(undefined)).toBeUndefined();
  });
});

describe("jobTags", () => {
  it("lists 急招, 包餐, 包住 and 学签可做 in that order when they apply", () => {
    expect(jobTags(job("j1"))).toEqual(["急招", "包餐", "学签可做"]);
    expect(jobTags({ ...job("j1"), accommodationIncluded: true })).toEqual(["急招", "包餐", "包住", "学签可做"]);
  });

  it("leaves out tags that do not apply", () => {
    expect(jobTags(job("j8"))).toEqual([]);
    expect(jobTags(job("j3"))).toEqual(["包餐"]);
  });
});

describe("postedAgoZh", () => {
  const now = Date.parse("2026-10-11T09:00:00Z");

  it("says 今天 within the first 24 hours", () => {
    expect(postedAgoZh("2026-10-11T00:00:00Z", now)).toBe("今天");
    expect(postedAgoZh("2026-10-10T09:00:01Z", now)).toBe("今天");
  });

  it("counts whole days after that", () => {
    expect(postedAgoZh("2026-10-10T09:00:00Z", now)).toBe("1 天前");
    expect(postedAgoZh("2026-10-01T00:00:00Z", now)).toBe("10 天前");
  });

  it("does not show a negative age when the clock is behind", () => {
    expect(postedAgoZh("2026-10-11T10:00:00Z", now)).toBe("今天");
  });
});
