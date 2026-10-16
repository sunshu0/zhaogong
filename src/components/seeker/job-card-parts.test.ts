import { describe, expect, it } from "vitest";
import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { cardPoints, cardStatus, cardTags } from "@/components/seeker/job-card-parts";
import type { Job } from "@/lib/types";

const j5 = MOCK_JOBS.find((job) => job.id === "j5")!;
const employer = MOCK_EMPLOYERS.find((e) => e.id === j5.employerId)!;

describe("a job card's parts (Round 19)", () => {
  it("puts place, work and hours, shifts and how to reach the employer on one line, without labels", () => {
    expect(cardPoints(j5, "Botany")).toEqual([
      "Botany",
      `${formatEmploymentTypes(j5.employmentType)} 每周 20–30 小时`,
      "早班 7:00–13:00",
      "聊天交换联系方式",
    ]);
    const bare: Job = { ...j5, employmentType: [], hoursPerWeek: undefined, shiftsZh: " ", contactPublic: true };
    expect(cardPoints(bare, undefined)).toEqual(["联系方式公开"]);
  });

  it("shows one status: 急招 before a verified employer, nothing for an unverified one", () => {
    expect(cardStatus({ ...j5, urgent: true }, employer)).toEqual({ kind: "urgent" });
    expect(cardStatus({ ...j5, urgent: false }, { ...employer, verification: "business_verified" })).toEqual({
      kind: "verified",
      verification: "business_verified",
    });
    expect(cardStatus({ ...j5, urgent: false }, { ...employer, verification: "unverified" })).toBeNull();
    expect(cardStatus({ ...j5, urgent: false }, undefined)).toBeNull();
  });

  it("keeps two tags after the status, 急招 not among them", () => {
    const all: Job = {
      ...j5,
      urgent: true,
      mealsIncluded: true,
      accommodationIncluded: true,
      visaAccepted: ["student"],
    };
    expect(cardTags(all)).toEqual(["包餐", "包住"]);
    expect(cardTags({ ...all, mealsIncluded: false, accommodationIncluded: false })).toEqual(["接受学签"]);
  });
});
