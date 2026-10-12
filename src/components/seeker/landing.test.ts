import { describe, expect, it } from "vitest";
import { employersOf } from "@/components/seeker/employers";
import { formatCount, POSITIONING } from "@/components/seeker/landing";
import { listFeaturedJobs } from "@/lib/data";

describe("formatCount", () => {
  it("writes counts as they are, with thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(43)).toBe("43");
    expect(formatCount(1234)).toBe("1,234");
  });
});

describe("employersOf", () => {
  it("finds each job's employer once", async () => {
    const jobs = await listFeaturedJobs("NZ", 6);
    const employers = await employersOf(jobs);
    for (const job of jobs) expect(employers.get(job.employerId)?.id).toBe(job.employerId);
    expect(employers.size).toBe(new Set(jobs.map((j) => j.employerId)).size);
  });
});

describe("POSITIONING", () => {
  it("has three or four short blocks and makes no number claims", () => {
    expect(POSITIONING.length).toBeGreaterThanOrEqual(3);
    expect(POSITIONING.length).toBeLessThanOrEqual(4);
    for (const block of POSITIONING) {
      expect(block.text.length).toBeLessThanOrEqual(60);
      expect(`${block.title}${block.text}`).not.toMatch(/[0-9０-９]|万|千|百/);
    }
  });
});
