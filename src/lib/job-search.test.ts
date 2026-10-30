import { describe, expect, it } from "vitest";
import { SEARCH_TERMS_MAX, jobSearchText, searchTerms } from "@/lib/job-search";
import { MOCK_JOBS } from "@/mock/data";

describe("the job list's search (bugs-1)", () => {
  it("splits at any space, full-width ones too, and reads full-width letters and capitals as usual", () => {
    expect(searchTerms("  厨师　奥克兰  ＭＴ Eden ")).toEqual(["厨师", "奥克兰", "mt", "eden"]);
    expect(searchTerms("厨师 厨师")).toEqual(["厨师"]);
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms(undefined)).toEqual([]);
    expect(searchTerms(Array.from({ length: 20 }, (_, i) => `词${i}`).join(" "))).toHaveLength(SEARCH_TERMS_MAX);
  });

  it("looks in the titles, descriptions, business, area in both languages and address", () => {
    const job = { ...MOCK_JOBS.find((j) => j.id === "j1")!, address: "123 Dominion Road" };
    const text = jobSearchText(job, "川味小馆");
    for (const part of ["前厅服务员", "点餐", "川味小馆", "mt eden", "奥克兰", "auckland", "dominion road"])
      expect(text).toContain(part);
    expect(jobSearchText(job)).not.toContain("川味小馆");
  });
});
