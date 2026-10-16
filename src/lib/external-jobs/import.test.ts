// The importer against hand-made API answers (fixtures/): no test reads a real API.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { EXTERNAL_COMPANIES, importAllowed, type ExternalCompany } from "@/config/external-companies";
import { getExternalJob, listExternalJobs, setExternalReview } from "@/db/external-jobs";
import { database } from "@/db/ready";
import { importExternalJobs } from "@/lib/external-jobs/import";
import { parseGreenhouse, parseLever, postingsUrl } from "@/lib/external-jobs/sources";
import { isShown, sectionOf } from "@/lib/external-jobs/visibility";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), "src/lib/external-jobs/fixtures", name), "utf8"));
const GREENHOUSE = fixture("greenhouse-kowhai.json");
const LEVER = fixture("lever-tui.json");

const checked = {
  checkedBy: "测试",
  checkedOn: "2026-10-17",
  allowsDisplay: true,
  note: "test company, made up",
};
const KOWHAI: ExternalCompany = {
  id: "kowhai",
  name: "Kowhai Robotics",
  source: "greenhouse",
  board: "kowhai",
  careersUrl: "https://kowhai.example.com/careers",
  terms: checked,
};
const TUI: ExternalCompany = {
  id: "tui",
  name: "Tui Software",
  source: "lever",
  board: "tui-example",
  careersUrl: "https://tui.example.com/careers",
  terms: checked,
};

const T0 = new Date("2026-10-17T01:00:00.000Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

/** A getter answering from the fixtures, counting what was asked. */
function feeds(answers: Record<string, unknown>) {
  const asked: string[] = [];
  return {
    asked,
    getJson: async (url: string) => {
      asked.push(url);
      if (!(url in answers)) throw new Error(`${url} answered 404`);
      return structuredClone(answers[url]);
    },
  };
}

const both = () =>
  feeds({
    [postingsUrl("greenhouse", "kowhai")]: GREENHOUSE,
    [postingsUrl("lever", "tui-example")]: LEVER,
  });

describe("external job import (#111)", () => {
  it("reads both APIs' answers into postings", () => {
    const gh = parseGreenhouse(GREENHOUSE);
    expect(gh).toHaveLength(5);
    expect(gh[0]).toMatchObject({
      externalId: "4001",
      title: "Graduate Software Engineer",
      locations: ["Auckland, New Zealand", "Auckland, New Zealand", "Auckland"],
      departments: ["Software"],
      url: "https://kowhai.example.com/careers/4001",
      postedAt: "2026-09-30T20:00:00.000Z",
    });
    expect(gh[0].text).toContain("A Bachelor's degree in Computer Science");
    expect(gh[1].pay).toEqual({ minCents: 12_000_000, maxCents: 15_000_000, currency: "NZD", period: "year" });

    const lv = parseLever(LEVER);
    expect(lv[0]).toMatchObject({
      title: "Full Stack Developer",
      country: "NZ",
      commitment: "Permanent",
      departments: ["Engineering", "Product"],
      pay: { minCents: 10_000_000, maxCents: 12_000_000, currency: "NZD", period: "year" },
    });
    expect(lv[0].text).toContain("A degree in Computer Science");
    expect(() => parseLever({ ok: false })).toThrow();
    expect(() => parseGreenhouse([])).toThrow();
  });

  it("keeps the facts of software and electrical jobs in New Zealand, all waiting for review, none shown", async () => {
    const { getJson } = both();
    const reports = await importExternalJobs({ companies: [KOWHAI, TUI], getJson, now: () => T0 });
    expect(reports).toEqual([
      { company: "kowhai", status: "imported", inFeed: 5, kept: 3, added: 3, updated: 0, backToReview: 0, removed: 0 },
      { company: "tui", status: "imported", inFeed: 4, kept: 2, added: 2, updated: 0, backToReview: 0, removed: 0 },
    ]);
    const jobs = await listExternalJobs();
    expect(jobs.map((j) => [j.id, j.field, j.kind, j.city, j.review])).toEqual([
      ["kowhai:4005", "electrical", "internship", "auckland", "pending"],
      ["kowhai:4001", "software", "graduate", "auckland", "pending"],
      ["kowhai:4002", "electrical", null, "christchurch", "pending"],
      ["tui:6f1d3a0e-0000-4000-8000-000000000001", "software", "full_time", "wellington", "pending"],
      ["tui:6f1d3a0e-0000-4000-8000-000000000002", "software", "internship", "auckland", "pending"],
    ]);
    expect(await listExternalJobs({ shownAt: T0 })).toEqual([]);

    expect(await getExternalJob("kowhai:4001")).toMatchObject({
      companyName: "Kowhai Robotics",
      source: "greenhouse",
      closesAt: "2026-11-20T10:59:59.000Z",
      degree: "bachelor",
      degreeSubjects: ["computer_science", "software_engineering"],
      visa: ["work_rights"],
      flags: [],
      lastSeenAt: T0.toISOString(),
      firstSeenAt: T0.toISOString(),
    });
    expect(await getExternalJob("kowhai:4002")).toMatchObject({
      minYears: 5,
      visa: [], // the posting says nothing about work rights: 原文未说明
      flags: ["other_citizenship"], // U.S. person: a moderator looks first (#112)
      pay: { minCents: 12_000_000, maxCents: 15_000_000, currency: "NZD", period: "year" },
    });
    expect(await getExternalJob("kowhai:4005")).toMatchObject({
      closesAt: "2026-11-01T10:59:00.000Z",
      flags: [], // an equal-opportunity sentence is not a requirement
      pay: { minCents: 3000, currency: "NZD", period: "hour" },
    });
    expect(await getExternalJob("tui:6f1d3a0e-0000-4000-8000-000000000001")).toMatchObject({
      minYears: 3,
      visa: ["no_sponsorship"],
      degreeSubjects: ["computer_science"],
    });
    expect(sectionOf("graduate")).toBe("internship");
    expect(sectionOf(null)).toBe("professional");
  });

  it("never stores the posting's own text", async () => {
    const db = await database();
    const rows = await db.all(sql`select * from external_jobs`);
    const stored = JSON.stringify(rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(stored).not.toMatch(/never reach the database/);
    expect(stored).not.toMatch(/orchard robots|motor controllers|rostering apps|platform team/);
    const columns = await db.all<{ name: string }>(sql`select name from pragma_table_info('external_jobs')`);
    expect(columns.map((c) => c.name)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/desc|content|text/)]),
    );
  });

  it("shows an approved job until it leaves the feed, its closing day ends or it goes 2 days without a refresh", async () => {
    expect(await setExternalReview("kowhai:4001", "approved", T0)).toBe(true);
    expect(await setExternalReview("tui:6f1d3a0e-0000-4000-8000-000000000002", "approved", T0)).toBe(true);
    expect((await listExternalJobs({ shownAt: T0 })).map((j) => j.id)).toEqual([
      "kowhai:4001",
      "tui:6f1d3a0e-0000-4000-8000-000000000002",
    ]);
    // Two days later without a refresh: still shown at exactly 2 days, gone after.
    expect((await listExternalJobs({ shownAt: days(2) })).length).toBe(2);
    expect((await listExternalJobs({ shownAt: new Date(days(2).getTime() + 1) })).length).toBe(0);

    // The next day's feed: Tui's intern is gone, Kowhai's graduate job got a new title.
    const next = structuredClone(GREENHOUSE);
    next.jobs[0].title = "Graduate Software Engineer (2027 intake)";
    const { getJson } = feeds({
      [postingsUrl("greenhouse", "kowhai")]: next,
      [postingsUrl("lever", "tui-example")]: LEVER.filter((p: { id: string }) => !p.id.endsWith("02")),
    });
    const reports = await importExternalJobs({ companies: [KOWHAI, TUI], getJson, now: () => days(1) });
    expect(reports).toMatchObject([
      { company: "kowhai", updated: 3, backToReview: 1, removed: 0 },
      { company: "tui", updated: 1, removed: 1 },
    ]);
    expect(await getExternalJob("tui:6f1d3a0e-0000-4000-8000-000000000002")).toMatchObject({
      removedAt: days(1).toISOString(),
      removedReason: "gone",
    });
    expect(await getExternalJob("kowhai:4001")).toMatchObject({ review: "pending", reviewedAt: null });
    expect(await listExternalJobs({ shownAt: days(1) })).toEqual([]);

    // Approved again; it shows until its closing day (20 November, New Zealand time) is over.
    await setExternalReview("kowhai:4001", "approved", days(1));
    const job = (await getExternalJob("kowhai:4001"))!;
    expect(isShown(job, Date.parse("2026-11-20T10:59:58.000Z") - 0)).toBe(false); // last refresh too old by then
    expect(isShown({ ...job, lastSeenAt: "2026-11-20T00:00:00.000Z" }, Date.parse("2026-11-20T10:59:58.000Z"))).toBe(
      true,
    );
    expect(isShown({ ...job, lastSeenAt: "2026-11-20T00:00:00.000Z" }, Date.parse("2026-11-20T10:59:59.000Z"))).toBe(
      false,
    );
  });

  it("takes a job down when an import finds its closing day over", async () => {
    const { getJson } = both();
    await importExternalJobs({ companies: [KOWHAI], getJson, now: () => new Date("2026-11-02T00:00:00.000Z") });
    expect(await getExternalJob("kowhai:4005")).toMatchObject({
      removedAt: "2026-11-02T00:00:00.000Z",
      removedReason: "closed",
    });
    expect(await getExternalJob("kowhai:4001")).toMatchObject({ removedAt: null });
  });

  it("leaves a company's jobs as they were when its feed cannot be read", async () => {
    const before = await listExternalJobs({ companyId: "kowhai" });
    const { getJson } = feeds({});
    const reports = await importExternalJobs({ companies: [KOWHAI], getJson, now: () => days(3) });
    expect(reports).toEqual([{ company: "kowhai", status: "failed", error: expect.stringMatching(/404/) }]);
    expect(await listExternalJobs({ companyId: "kowhai" })).toEqual(before);
  });

  it("does not read a company whose terms nobody checked, and takes down what it had", async () => {
    const { asked, getJson } = both();
    const unchecked = { ...KOWHAI, terms: null };
    const reports = await importExternalJobs({ companies: [unchecked], getJson, now: () => days(3) });
    expect(asked).toEqual([]);
    expect(reports).toEqual([{ company: "kowhai", status: "terms_not_checked", takenDown: 2 }]);
    expect((await listExternalJobs({ companyId: "kowhai" })).every((j) => j.removedAt != null)).toBe(true);

    expect(importAllowed({ ...KOWHAI, terms: { ...checked, allowsDisplay: false } })).toBe(false);
    expect(importAllowed({ ...KOWHAI, terms: { ...checked, checkedOn: "" } })).toBe(false);
  });

  it("can read a feed to look at the facts without storing anything (dry run)", async () => {
    const before = await listExternalJobs();
    const { getJson } = both();
    const [report] = await importExternalJobs({ companies: [{ ...TUI, terms: null }], getJson, dryRun: true });
    expect(report).toMatchObject({ company: "tui", status: "dry_run", inFeed: 4 });
    expect(report.status === "dry_run" && report.jobs.map((j) => j.title)).toEqual([
      "Full Stack Developer",
      "Software Engineering Intern",
    ]);
    expect(await listExternalJobs()).toEqual(before);
  });

  it("has no company on the real list whose terms are marked checked without a person and a day", () => {
    for (const company of EXTERNAL_COMPANIES) {
      if (company.terms) {
        expect(company.terms.checkedBy.trim()).not.toBe("");
        expect(company.terms.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(company.terms.note.trim()).not.toBe("");
      }
    }
    expect(new Set(EXTERNAL_COMPANIES.map((c) => c.id)).size).toBe(EXTERNAL_COMPANIES.length);
  });
});
