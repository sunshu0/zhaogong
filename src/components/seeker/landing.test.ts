import { describe, expect, it } from "vitest";
import { employersOf } from "@/components/seeker/employers";
import { aiFeature, EMPLOYER_EXAMPLE, features, formatCount, heroCounts } from "@/components/seeker/landing";
import { DEMO_DATA, STAT_MIN_TO_SHOW } from "@/config/landing";
import { englishSummary, parsePost } from "@/lib/ai-post";
import { listFeaturedJobs } from "@/lib/data";

describe("formatCount", () => {
  it("writes counts as they are, with thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(43)).toBe("43");
    expect(formatCount(1234)).toBe("1,234");
  });
});

describe("heroCounts (#51: the home page's one line of numbers)", () => {
  const stats = { employersPosting: 8, jobsPosted: 19, hiresConfirmed: 13, contactViews: 63 };

  it("starts with the open jobs and their verified employers, then hires and contacts, never the duplicates", () => {
    const parts = heroCounts(16, 6, stats);
    expect(parts.slice(0, 2)).toEqual([
      { value: 16, label: "个职位在招，来自" },
      { value: 6, label: "家已验证雇主" },
    ]);
    expect(
      heroCounts(16, 6, stats, "en")
        .slice(0, 2)
        .map((p) => p.label),
    ).toEqual(["open jobs, from", "verified employers"]);
    // One of each reads in the singular.
    expect(heroCounts(1, 1, stats, "en").map((p) => p.label)).toEqual(
      expect.arrayContaining(["open job, from", "verified employer"]),
    );
    const rest = parts.slice(2).map((p) => p.label);
    expect(rest).not.toContain("个职位");
    expect(rest).not.toContain("家雇主发布过招聘");
    if (DEMO_DATA)
      expect(parts.slice(2)).toEqual([
        { value: 13, label: "人通过这里找到工作" },
        { value: 63, label: "次咨询雇主" },
      ]);
  });

  it("leaves out hires and contacts below their thresholds unless the data is demo data", () => {
    const low = { ...stats, hiresConfirmed: STAT_MIN_TO_SHOW.hiresConfirmed - 1, contactViews: 0 };
    expect(heroCounts(3, 1, low)).toHaveLength(DEMO_DATA ? 4 : 2);
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

describe("features", () => {
  it("shows the AI chat post and three more, short, with an icon each and no number claims", () => {
    expect(features().map((f) => f.title)).toEqual(["发布前合规检查", "雇主验证与防骗", "中文为主"]);
    for (const block of [...features(), { ...aiFeature(), icon: "chat" as const }]) {
      expect(block.text.length).toBeLessThanOrEqual(70);
      expect(["chat", "language", "check", "shield"]).toContain(block.icon);
      expect(`${block.title}${block.text}`.replace("AI", "")).not.toMatch(/[0-9０-９]|万|千|百/);
    }
  });

  it("says the same in English, still without number claims (Round 20)", () => {
    expect(features("en").map((f) => f.title)).toEqual([
      "Checks before posting",
      "Verified employers, fewer scams",
      "Chinese first",
    ]);
    for (const block of [...features("en"), aiFeature("en")])
      expect(`${block.title}${block.text}`.replace("AI", "")).not.toMatch(/[0-9]|hundred|thousand/i);
  });
});

describe("EMPLOYER_EXAMPLE", () => {
  it("is a real parser example without contact details", () => {
    // The first three lines of MSG.frontOfHouse in src/lib/ai-post/parse.test.ts; its last line (WeChat and phone)
    // is left out because contact details are shown to signed-in users only.
    expect(EMPLOYER_EXAMPLE.split("\n")).toHaveLength(3);
    expect(EMPLOYER_EXAMPLE).not.toMatch(/微信|电话|021|demo_/);
  });

  it("parses into the bilingual job the employer band shows", async () => {
    const { draft } = await parsePost(EMPLOYER_EXAMPLE, "NZ");
    expect(draft).toMatchObject({
      titleZh: "前厅服务员",
      titleEn: "Front-of-house staff",
      regionId: "akl-mt-eden",
      employmentType: ["part_time"],
      pay: { min: 25, max: 27 },
      hoursPerWeek: { min: 15, max: 25 },
      mealsIncluded: true,
      urgent: true,
    });
    expect(draft.visaAccepted).toEqual(["student"]);
    expect(englishSummary(draft, "NZ").length).toBeGreaterThan(20);
  });
});
