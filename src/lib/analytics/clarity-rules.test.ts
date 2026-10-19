import { describe, expect, it } from "vitest";
import {
  MAX_PROMPTS,
  consentCookie,
  isNoRecordPath,
  parseConsent,
  shouldLoadClarity,
  shouldPrompt,
} from "@/lib/analytics/clarity-rules";

const live = { projectId: "abc123", production: true, testBuild: false };

describe("when Clarity may run (#313, ADR 0025 §6)", () => {
  it("only in a production build with a project, after the visitor agreed, on a page it may record", () => {
    expect(shouldLoadClarity(live, "clarity", "/jobs", false)).toBe(true);
    expect(shouldLoadClarity(live, null, "/jobs", false)).toBe(false);
    expect(shouldLoadClarity(live, "none", "/jobs", false)).toBe(false);
    expect(shouldLoadClarity({ ...live, projectId: undefined }, "clarity", "/jobs", false)).toBe(false);
    expect(shouldLoadClarity({ ...live, production: false }, "clarity", "/jobs", false)).toBe(false);
    expect(shouldLoadClarity({ ...live, testBuild: true }, "clarity", "/jobs", false)).toBe(false);
    expect(shouldLoadClarity(live, "clarity", "/external/x", true)).toBe(false);
  });

  it("never on the pages the ADR lists, the internship section included", () => {
    for (const path of [
      "/login",
      "/account",
      "/account/data",
      "/messages",
      "/notifications",
      "/workspace",
      "/profile",
      "/profile/resume",
      "/resume/r1",
      "/candidates/c1",
      "/me",
      "/me/saved",
      "/me/alerts",
      "/admin",
      "/employer/verify",
      "/employer/team",
      "/employer/jobs/j1/applicants",
      "/internships",
    ])
      expect(isNoRecordPath(path)).toBe(true);
    for (const path of ["/", "/jobs", "/jobs/j1", "/professional", "/external/x", "/employer/post", "/employer/jobs"])
      expect(isNoRecordPath(path)).toBe(false);
    expect(isNoRecordPath("/meals")).toBe(false);
  });
});

describe("the consent prompt (ADR 0025 §7)", () => {
  it("asks only where Clarity is set up, until answered, at most MAX_PROMPTS times", () => {
    expect(shouldPrompt(live, null, 0)).toBe(true);
    expect(shouldPrompt(live, null, MAX_PROMPTS - 1)).toBe(true);
    expect(shouldPrompt(live, null, MAX_PROMPTS)).toBe(false);
    expect(shouldPrompt(live, "none", 0)).toBe(false);
    expect(shouldPrompt(live, "clarity", 0)).toBe(false);
    expect(shouldPrompt({ ...live, projectId: undefined }, null, 0)).toBe(false);
    expect(shouldPrompt({ ...live, production: false }, null, 0)).toBe(false);
    // The test build asks (to test the prompt) but never loads Clarity.
    expect(shouldPrompt({ ...live, testBuild: true }, null, 0)).toBe(true);
  });

  it("keeps the answer in zg_consent for a year", () => {
    expect(parseConsent("a=1; zg_consent=clarity; b=2")).toBe("clarity");
    expect(parseConsent("zg_consent=none")).toBe("none");
    expect(parseConsent("zg_consent=yes")).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(consentCookie("clarity", true)).toBe("zg_consent=clarity; Max-Age=31536000; Path=/; SameSite=Lax; Secure");
    expect(consentCookie("none", false)).toBe("zg_consent=none; Max-Age=31536000; Path=/; SameSite=Lax");
  });
});
