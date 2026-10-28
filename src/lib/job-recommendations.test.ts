import { describe, expect, it } from "vitest";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";
import { hasJobPreferences, jobPreferences, recommendJobs } from "./job-recommendations";

const job = (id: string, patch: Partial<Job> = {}): Job => ({
  ...MOCK_JOBS[0],
  id,
  roles: ["cleaner"],
  regionId: "akl-cbd",
  pay: { min: 24 },
  ...patch,
});
const ids = (jobs: readonly Job[]) => jobs.map(({ id }) => id);

describe("your explicit job preferences", () => {
  it("projects only the three validated fields, even for a private CV", () => {
    const preferences = jobPreferences({
      discoverable: false,
      roles: ["cook", "cook", "unknown"],
      regionIds: ["akl-cbd", "unknown"],
      expectedMinPay: 0,
      skills: "cleaner",
      experienceYears: 12,
      employmentTypes: ["full_time"],
      phone: "private",
    });
    expect(preferences).toEqual({ roles: ["cook"], regionIds: ["akl-cbd"], expectedMinPay: 0 });
    expect(hasJobPreferences(preferences)).toBe(true);
    expect(
      jobPreferences({
        roles: ["cook"],
        get skills() {
          throw new Error("Not a recommendation input");
        },
        get discoverable() {
          throw new Error("Not a visibility-gated feature");
        },
      }),
    ).toEqual({ roles: ["cook"], regionIds: [], expectedMinPay: undefined });
    for (const value of [
      undefined,
      null,
      {},
      { roles: ["unknown"], regionIds: ["unknown"], expectedMinPay: NaN },
      { expectedMinPay: -1 },
      { expectedMinPay: 201 },
    ]) {
      expect(hasJobPreferences(jobPreferences(value))).toBe(false);
    }
  });

  it("keeps the latest/urgent input order when there are no preferences or no matches", () => {
    const jobs = [job("urgent", { urgent: true }), job("newest"), job("oldest")];
    for (const preferences of [{}, { roles: ["cook"], regionIds: ["akl-albany"], expectedMinPay: 100 }]) {
      expect(recommendJobs(jobs, jobPreferences(preferences))).toEqual({ jobs, matched: false, reordered: false });
    }
    expect(recommendJobs([], jobPreferences({ roles: ["cook"] }))).toEqual({
      jobs: [],
      matched: false,
      reordered: false,
    });
  });

  it("supports each preference alone, including either explicit role on a multi-role job", () => {
    const jobs = [
      job("neither"),
      job("pay", { pay: { min: 26, max: 35 } }),
      job("region", { regionId: "akl-albany" }),
      job("role", { roles: ["barista", "cook"] }),
    ];
    for (const [preferences, first] of [
      [{ roles: ["cook"] }, "role"],
      [{ regionIds: ["akl-albany"] }, "region"],
      [{ expectedMinPay: 30 }, "pay"],
    ] as const) {
      const ranked = recommendJobs(jobs, jobPreferences(preferences));
      expect(ranked.matched).toBe(true);
      expect(ranked.reordered).toBe(true);
      expect(ranked.jobs[0].id).toBe(first);
      expect(ids(ranked.jobs.slice(1))).toEqual(ids(jobs.filter(({ id }) => id !== first)));
    }
  });

  it("uses equal weights for supplied fields and keeps all ties in the existing latest order", () => {
    const jobs = [
      job("none"),
      job("pay", { pay: { min: 30 } }),
      job("region", { regionId: "akl-albany" }),
      job("role", { roles: ["cook"] }),
      job("two", { roles: ["cook"], regionId: "akl-albany" }),
      job("all", { roles: ["cook"], regionId: "akl-albany", pay: { min: 30 } }),
    ];
    expect(
      ids(recommendJobs(jobs, jobPreferences({ roles: ["cook"], regionIds: ["akl-albany"], expectedMinPay: 30 })).jobs),
    ).toEqual(["all", "two", "pay", "region", "role", "none"]);
    expect(ids(recommendJobs(jobs, jobPreferences({ roles: ["cook"], regionIds: ["akl-albany"] })).jobs)).toEqual([
      "two",
      "all",
      "region",
      "role",
      "none",
      "pay",
    ]);
  });

  it("counts a category once, not once for each matching role or region", () => {
    const jobs = [job("one", { roles: ["cook"] }), job("two", { roles: ["cook", "barista"] })];
    expect(ids(recommendJobs(jobs, jobPreferences({ roles: ["cook", "barista"] })).jobs)).toEqual(["one", "two"]);
  });

  it("accepts the legacy job-side category fallback but never infers your preferences from prose", () => {
    const jobs = [
      job("unknown", { roles: [], titleZh: "招聘", titleEn: "Hiring" }),
      job("legacy", { roles: undefined, titleZh: "厨师", titleEn: "Cook", industry: "hospitality" }),
    ];
    expect(recommendJobs(jobs, jobPreferences({ skills: "厨师", headline: "厨师", bio: "Cook" })).matched).toBe(false);
    expect(ids(recommendJobs(jobs, jobPreferences({ roles: ["cook"] })).jobs)).toEqual(["legacy", "unknown"]);
  });

  it("uses the hourly pay range consistently and treats zero as a supplied preference", () => {
    const jobs = [
      job("below", { pay: { min: 24, max: 29 } }),
      job("range", { pay: { min: 25, max: 30 } }),
      job("rate", { pay: { min: 30 } }),
    ];
    expect(ids(recommendJobs(jobs, jobPreferences({ expectedMinPay: 30 })).jobs)).toEqual(["range", "rate", "below"]);
    // Pay 0: every job meets it, so nothing moves and the page must not say it ordered by preferences.
    expect(recommendJobs(jobs, jobPreferences({ expectedMinPay: 0 }))).toEqual({
      jobs,
      matched: true,
      reordered: false,
    });
  });

  it("does not count a list where every job meets the same preferences as reordered", () => {
    // As when the filter's region is the preferred region: all match once, the latest order stays.
    const jobs = [job("a", { regionId: "akl-albany" }), job("b", { regionId: "akl-albany" })];
    const ranked = recommendJobs(jobs, jobPreferences({ regionIds: ["akl-albany"] }));
    expect(ranked).toEqual({ jobs, matched: true, reordered: false });
    expect(recommendJobs([jobs[0]], jobPreferences({ regionIds: ["akl-albany"] })).reordered).toBe(false);
  });

  it("retains every employment form, ignores other resume facts and does not mutate inputs", () => {
    const jobs = Object.freeze([
      Object.freeze(job("full", { employmentType: ["full_time"] })),
      Object.freeze(job("part", { employmentType: ["part_time"] })),
      Object.freeze(job("casual", { employmentType: ["casual"] })),
      Object.freeze(job("multiple", { employmentType: ["full_time", "part_time", "casual"] })),
    ]);
    const snapshot = JSON.stringify(jobs);
    const preferences = Object.freeze({ roles: Object.freeze(["cleaner"] as const), regionIds: Object.freeze([]) });
    const result = recommendJobs(jobs, preferences);
    expect(result.jobs).toEqual(jobs);
    expect(result.jobs).not.toBe(jobs);
    expect(JSON.stringify(jobs)).toBe(snapshot);
    for (const discoverable of [true, false]) {
      expect(
        recommendJobs(
          jobs,
          jobPreferences({
            roles: ["cleaner"],
            employmentTypes: ["full_time"],
            languages: "English",
            discoverable,
            experienceYears: 20,
          }),
        ).jobs,
      ).toEqual(jobs);
    }
  });
});
