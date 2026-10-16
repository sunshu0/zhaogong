import { describe, expect, it } from "vitest";
import { recommendableCandidates } from "@/lib/candidate-directory";
import { initialProfile, parseProfiles } from "@/components/seeker/hub-state";
import { identityScope } from "@/components/seeker/identity-scope";
import { EMPTY_RESUME } from "@/lib/candidate-matching";
import type { DemoSession } from "@/components/seeker/session";

const employer: DemoSession = {
  email: "owner@example.com",
  activeRole: "employer",
  employerId: "e1",
  employerName: "店铺",
  signedInAt: "2026-10-13",
};
const other = { ...employer, email: "candidate@example.com", activeRole: "seeker" as const };
const profile = {
  ...initialProfile(other),
  name: "王芳",
  contactName: "private contact",
  resume: { ...EMPTY_RESUME, candidateId: "abc-123", discoverable: true },
};

describe("candidate directory", () => {
  it("includes only opted-in seekers, excludes own identity and employer profiles", () => {
    const accounts = {
      [identityScope(other)]: profile,
      [identityScope({ ...employer, activeRole: "seeker" })]: profile,
      [identityScope(employer)]: profile,
      [identityScope({ ...other, email: "hidden@example.com" })]: {
        ...profile,
        resume: { ...profile.resume, discoverable: false },
      },
    };
    const result = recommendableCandidates(accounts, employer);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("local-abc-123");
    expect(result[0]).not.toHaveProperty("contactName");
    expect(JSON.stringify(result)).not.toContain("@example.com");
    expect(recommendableCandidates(accounts, other)).toEqual([]);
    expect(recommendableCandidates(accounts, null)).toEqual([]);
  });
  it("withdraws a profile immediately and keeps old profiles private", () => {
    const scope = identityScope(other);
    expect(recommendableCandidates({ [scope]: initialProfile(other) }, employer)).toEqual([]);
    const profiles = parseProfiles(JSON.stringify({ [scope]: profile }));
    expect(recommendableCandidates(profiles, employer)).toHaveLength(1);
    profiles[scope].resume!.discoverable = false;
    expect(recommendableCandidates(profiles, employer)).toEqual([]);
  });
});
