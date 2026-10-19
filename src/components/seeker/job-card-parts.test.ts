import { describe, expect, it } from "vitest";
import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { cardPoints, cardStatus, cardTags } from "@/components/seeker/job-card-parts";
import type { Job } from "@/lib/types";

const j5 = MOCK_JOBS.find((job) => job.id === "j5")!;
const employer = MOCK_EMPLOYERS.find((e) => e.id === j5.employerId)!;

describe("a job card's parts (Round 19)", () => {
  it("puts place, how to reach the employer, work and short hours, and the shifts last, without labels", () => {
    expect(cardPoints(j5, "Botany").map((p) => p.text)).toEqual([
      "Botany",
      "聊天交换联系方式",
      `${formatEmploymentTypes(j5.employmentType)} 20–30 小时/周`,
      "早班 7:00–13:00",
    ]);
    const bare: Job = { ...j5, employmentType: [], hoursPerWeek: undefined, shiftsZh: " ", contactPublic: true };
    expect(cardPoints(bare, undefined).map((p) => p.text)).toEqual(["联系方式公开"]);
    // An area named after two places shows the first, so the contact stays on a phone's line (#242).
    expect(cardPoints(bare, "Mt Wellington / Sylvia Park")[0]).toEqual({ text: "Mt Wellington" });
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
    expect(cardTags(all)).toEqual(["meals", "housing"]);
    expect(cardTags({ ...all, mealsIncluded: false, accommodationIncluded: false })).toEqual(["student"]);
  });

  it("says the line in English, and marks the shifts as the employer's own Chinese", () => {
    const points = cardPoints(j5, "Botany", "en");
    expect(points.map((p) => p.text)).toEqual([
      "Botany",
      "Contact in chat",
      `${formatEmploymentTypes(j5.employmentType, "en")} 20–30 h/wk`,
      "早班 7:00–13:00",
    ]);
    expect(points.filter((p) => p.zh).map((p) => p.text)).toEqual(["早班 7:00–13:00"]);
  });
});
