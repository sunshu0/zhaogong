import { describe, expect, it } from "vitest";
import { employersOf } from "@/components/seeker/employers";
import { AI_FEATURE, EMPLOYER_EXAMPLE, FEATURES, formatCount } from "@/components/seeker/landing";
import { englishSummary, parsePost } from "@/lib/ai-post";
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

describe("FEATURES", () => {
  it("shows the AI chat post and three more, short, with an icon each and no number claims", () => {
    expect(FEATURES.map((f) => f.title)).toEqual(["发布前合规检查", "雇主验证与防骗", "中文为主"]);
    for (const block of [...FEATURES, { ...AI_FEATURE, icon: "chat" as const }]) {
      expect(block.text.length).toBeLessThanOrEqual(70);
      expect(["chat", "language", "check", "shield"]).toContain(block.icon);
      expect(`${block.title}${block.text}`.replace("AI", "")).not.toMatch(/[0-9０-９]|万|千|百/);
    }
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
