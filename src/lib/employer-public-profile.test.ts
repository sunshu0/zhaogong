import { expect, it } from "vitest";
import { employerPublicProfile } from "@/lib/employer-public-profile";
import { initialProfile } from "@/components/seeker/hub-state";

it("publishes only company fields for the requested employer identity", () => {
  const profile = {
    ...initialProfile(null),
    name: "企业",
    bio: "企业介绍",
    resume: { discoverable: true, skills: "private", employmentTypes: [], regionIds: [] },
    privateDetails: {
      phone: "09 055 8888",
      wechat: "private",
      email: "private@example.com",
      address: "private location",
    },
  };
  const accounts = {
    [JSON.stringify(["owner@example.com", "seeker", null])]: { ...profile, bio: "私人简历" },
    [JSON.stringify(["owner@example.com", "employer", "e2"])]: { ...profile, bio: "另一家企业" },
    [JSON.stringify(["owner@example.com", "employer", "e1"])]: profile,
  };
  const result = employerPublicProfile(accounts, "e1");
  expect(result?.bio).toBe("企业介绍");
  expect(result).not.toHaveProperty("resume");
  expect(result).not.toHaveProperty("email");
  expect(result).not.toHaveProperty("privateDetails");
  expect(JSON.stringify(result)).not.toContain("private");
  expect(employerPublicProfile(accounts, "missing")).toBeUndefined();
});
