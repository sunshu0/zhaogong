import { describe, expect, it } from "vitest";
import { PREVIEW_DESCRIPTION_MAX, previewEmployer, previewJob } from "@/components/seeker/job-preview";
import type { Employer, Job } from "@/lib/types";

const job = {
  id: "j1",
  titleZh: "服务员",
  descriptionZh: "  前厅服务，周末班。  ",
  descriptionEn: "Front of house.",
  contactPublic: true,
  contact: { phone: "021 000 000", wechat: "boss", email: "boss@example.com" },
  hiresConfirmed: 2,
  hiresConfirmedAt: "2026-10-01T00:00:00.000Z",
} as unknown as Job;

describe("previewJob", () => {
  it("never carries the contact details or the English description to the browser (ADR 0002)", () => {
    const preview = previewJob(job);
    expect(preview).not.toHaveProperty("contact");
    expect(preview).not.toHaveProperty("descriptionEn");
    expect(preview).not.toHaveProperty("hiresConfirmed");
    expect(JSON.stringify(preview)).not.toMatch(/021 000 000|boss@example\.com/);
    expect(preview.descriptionZh).toBe("前厅服务，周末班。");
    expect(preview.contactPublic).toBe(true);
  });

  it("cuts a long description and marks the cut", () => {
    const long = previewJob({ ...job, descriptionZh: "字".repeat(PREVIEW_DESCRIPTION_MAX + 50) });
    expect(long.descriptionZh).toHaveLength(PREVIEW_DESCRIPTION_MAX + 1);
    expect(long.descriptionZh.endsWith("…")).toBe(true);
  });
});

describe("previewEmployer", () => {
  it("keeps the name and verification and says whether the business is banned", () => {
    const employer = {
      id: "e1",
      name: "北岸早茶",
      verification: "business_verified",
      bannedAt: "2026-10-02",
    } as unknown as Employer;
    expect(previewEmployer(employer)).toEqual({
      id: "e1",
      name: "北岸早茶",
      verification: "business_verified",
      banned: true,
    });
  });

  it("carries the activity the list already read, and nothing when there is none", () => {
    const employer = { id: "e1", name: "北岸早茶", verification: "unverified" } as unknown as Employer;
    expect(previewEmployer(employer, { onlineToday: true, replies: "hour" }).activity).toEqual({
      onlineToday: true,
      replies: "hour",
    });
    expect(previewEmployer(employer)).not.toHaveProperty("activity");
  });
});
