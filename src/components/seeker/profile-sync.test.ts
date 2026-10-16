import { describe, expect, it } from "vitest";
import { parseSyncMarks, samePage, syncStep } from "@/components/seeker/profile-sync";

const AT = "2026-10-17T05:00:00.000Z";
const LATER = "2026-10-17T06:00:00.000Z";
const mine = { name: "王芳", bio: "会做咖啡" };
const theirs = { name: "王芳", bio: "会做咖啡，也会收银" };

describe("syncStep", () => {
  it("does nothing when neither has a page, and uploads a page only this browser has", () => {
    expect(syncStep(undefined, { profile: null, updatedAt: null }, undefined)).toBe("same");
    expect(syncStep({}, { profile: null, updatedAt: null }, undefined)).toBe("same");
    expect(syncStep(mine, { profile: null, updatedAt: null }, undefined)).toBe("upload");
  });

  it("takes the account's page into a browser that has none (a new device)", () => {
    expect(syncStep(undefined, { profile: mine, updatedAt: AT }, undefined)).toBe("take");
    expect(syncStep({}, { profile: mine, updatedAt: AT }, { at: AT })).toBe("take");
  });

  it("is the same page whatever order the fields were written in", () => {
    expect(syncStep({ bio: mine.bio, name: mine.name }, { profile: mine, updatedAt: AT }, undefined)).toBe("same");
    expect(
      samePage(
        { resume: { discoverable: true, skills: "", employmentTypes: [], regionIds: [] } },
        {
          resume: { regionIds: [], employmentTypes: [], skills: "", discoverable: true },
        },
      ),
    ).toBe(true);
    expect(samePage({ name: "a" }, { name: "a", bio: "b" })).toBe(false);
  });

  it("uploads changes made here to the version they started from", () => {
    expect(syncStep(theirs, { profile: mine, updatedAt: AT }, { at: AT, dirty: true })).toBe("upload");
  });

  it("takes the account's page when it changed elsewhere and nothing here waits to be saved", () => {
    expect(syncStep(mine, { profile: theirs, updatedAt: LATER }, { at: AT })).toBe("take");
  });

  it("asks when both changed, or when this browser never matched the account's page", () => {
    expect(syncStep(mine, { profile: theirs, updatedAt: LATER }, { at: AT, dirty: true })).toBe("ask");
    expect(syncStep(mine, { profile: theirs, updatedAt: LATER }, undefined)).toBe("ask");
    expect(syncStep(mine, { profile: theirs, updatedAt: LATER }, { dirty: true })).toBe("ask");
  });
});

describe("parseSyncMarks", () => {
  it("keeps readable marks and drops the rest", () => {
    expect(parseSyncMarks(JSON.stringify({ a: { at: AT, dirty: true }, b: { at: 3, dirty: "yes" }, c: 1 }))).toEqual({
      a: { at: AT, dirty: true },
      b: {},
    });
    expect(parseSyncMarks("not json")).toEqual({});
    expect(parseSyncMarks(null)).toEqual({});
    expect(parseSyncMarks("[]")).toEqual({});
  });
});
