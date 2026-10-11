import { describe, expect, it } from "vitest";
import { listJobs, matchesFilter } from "@/lib/data";
import { MOCK_JOBS } from "@/mock/data";

describe("job filter", () => {
  it("lists only active NZ jobs, newest first", async () => {
    const jobs = await listJobs({ country: "NZ" });
    expect(jobs.length).toBe(MOCK_JOBS.length);
    for (let i = 1; i < jobs.length; i++) {
      expect(jobs[i - 1].postedAt.slice(0, 10) >= jobs[i].postedAt.slice(0, 10)).toBe(true);
    }
  });

  it("filters by visa, industry and minimum pay", async () => {
    const jobs = await listJobs({ country: "NZ", visa: "student", industries: ["hospitality"], minPay: 25 });
    expect(jobs.map((j) => j.id).sort()).toEqual(["j1"]);
  });

  it("matches the query in either language", () => {
    const job = MOCK_JOBS.find((j) => j.id === "j3")!;
    expect(matchesFilter(job, { country: "NZ", query: "点心" })).toBe(true);
    expect(matchesFilter(job, { country: "NZ", query: "dim sum" })).toBe(true);
    expect(matchesFilter(job, { country: "NZ", query: "叉车" })).toBe(false);
  });

  it("ignores markets that are not opened", async () => {
    expect(await listJobs({ country: "AU" })).toEqual([]);
  });
});
