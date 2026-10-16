import { describe, expect, it } from "vitest";
import { jobPostingJsonLd, jsonLdText } from "@/lib/job-posting";
import type { Employer, Job } from "@/lib/types";

const job: Job = {
  id: "j1",
  country: "NZ",
  employerId: "e1",
  titleZh: "前厅服务员",
  titleEn: "Front-of-house staff",
  industry: "hospitality",
  employmentType: ["part_time", "casual"],
  regionId: "akl-mt-eden",
  address: "123 Dominion Rd",
  pay: { min: 25, max: 27 },
  mealsIncluded: true,
  accommodationIncluded: false,
  visaAccepted: ["student"],
  languages: ["mandarin"],
  descriptionZh: "负责点单、上菜。\n周末晚班。",
  descriptionEn: "Take orders & serve <tables>.",
  contactPublic: true,
  contact: { phone: "09 055 0101", wechat: "chuanwei", email: "boss@example.com" },
  status: "active",
  postedAt: "2026-10-10T09:00:00.000Z",
  expiresAt: "2026-11-09T09:00:00.000Z",
  urgent: true,
};
const employer = { id: "e1", name: "川味小馆" } as Employer;

describe("jobPostingJsonLd", () => {
  const data = jobPostingJsonLd(job, employer, "https://zhaogong.example");

  it("has the facts search engines ask for", () => {
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "前厅服务员",
      url: "https://zhaogong.example/jobs/j1",
      datePosted: "2026-10-10T09:00:00.000Z",
      validThrough: "2026-11-09T09:00:00.000Z",
      employmentType: ["PART_TIME", "TEMPORARY"],
      hiringOrganization: { name: "川味小馆", sameAs: "https://zhaogong.example/employers/e1" },
      jobLocation: {
        address: {
          streetAddress: "123 Dominion Rd",
          addressLocality: "Mt Eden / Dominion Rd",
          addressRegion: "Auckland",
          addressCountry: "NZ",
        },
      },
      baseSalary: { currency: "NZD", value: { minValue: 25, maxValue: 27, unitText: "HOUR" } },
    });
  });

  it("writes the description as escaped paragraphs, Chinese first", () => {
    expect(data.description).toBe(
      "<p>负责点单、上菜。</p><p>周末晚班。</p><p>Take orders &amp; serve &lt;tables&gt;.</p>",
    );
  });

  it("gives a single rate as one value", () => {
    const single = jobPostingJsonLd({ ...job, pay: { min: 24 } }, employer, "https://zhaogong.example");
    expect(single.baseSalary.value).toEqual({ "@type": "QuantitativeValue", value: 24, unitText: "HOUR" });
  });

  it("never carries contact details", () => {
    const text = JSON.stringify(data);
    for (const detail of ["09 055 0101", "chuanwei", "boss@example.com"]) expect(text).not.toContain(detail);
  });
});

describe("jsonLdText", () => {
  it("cannot close the script tag it sits in, and reads back the same", () => {
    const text = jsonLdText({ title: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ title: "</script><script>alert(1)</script>" });
  });
});
