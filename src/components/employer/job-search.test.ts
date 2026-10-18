import { describe, expect, it } from "vitest";
import { searchJobs } from "@/components/employer/job-search";

const jobs = [
  { id: "a", titleZh: "北岸店 厨房帮工", titleEn: "Kitchen Hand" },
  { id: "b", titleZh: "前厅服务员", titleEn: "Front of House" },
  { id: "c", titleZh: "市中心店厨房帮工", titleEn: "Kitchen Hand (CBD)" },
];

describe("searchJobs (#198)", () => {
  it("keeps jobs whose Chinese or English title has the words, ignoring spaces and case", () => {
    expect(searchJobs(jobs, "厨房 帮工").map((j) => j.id)).toEqual(["a", "c"]);
    expect(searchJobs(jobs, "北岸店厨房").map((j) => j.id)).toEqual(["a"]);
    expect(searchJobs(jobs, "front OF").map((j) => j.id)).toEqual(["b"]);
    expect(searchJobs(jobs, "ＣＢＤ").map((j) => j.id)).toEqual(["c"]);
  });

  it("keeps everything for an empty search, and nothing when nothing matches", () => {
    expect(searchJobs(jobs, "  ")).toHaveLength(3);
    expect(searchJobs(jobs, "洗碗")).toEqual([]);
  });
});
