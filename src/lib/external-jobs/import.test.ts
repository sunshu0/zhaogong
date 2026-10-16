// The importer against hand-made API answers (fixtures/): no test reads a real API.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { EXTERNAL_COMPANIES, importAllowed, type ExternalCompany } from "@/config/external-companies";
import { getExternalJob, listExternalJobs as listAll, setExternalReview } from "@/db/external-jobs";
import { database } from "@/db/ready";
import { importExternalJobs, takeDownUnlisted } from "@/lib/external-jobs/import";
import { parseAshby, parseGreenhouse, parseLever, postingsUrl } from "@/lib/external-jobs/sources";
import { isShown, sectionOf } from "@/lib/external-jobs/visibility";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), "src/lib/external-jobs/fixtures", name), "utf8"));
const GREENHOUSE = fixture("greenhouse-kowhai.json");
const LEVER = fixture("lever-tui.json");
const ASHBY = fixture("ashby-pukeko.json");

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

/** The jobs of this file's companies, leaving out the demo data (src/mock/external-jobs.ts). */
const listExternalJobs = async (options?: Parameters<typeof listAll>[0]) =>
  (await listAll(options)).filter((job) => !job.companyId.startsWith("demo-"));

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

  it("takes down the jobs of a company taken off the list, but not the demo's made-up companies", async () => {
    const { getJson } = both();
    await importExternalJobs({ companies: [KOWHAI, TUI], getJson, now: () => days(5) });
    const up = (id: string) => listAll({ companyId: id }).then((jobs) => jobs.filter((j) => j.removedAt == null));
    const kowhai = (await up("kowhai")).length;
    const tui = (await up("tui")).length;
    const demo = (await up("demo-kowhai")).length + (await up("demo-tui")).length;
    expect(Math.min(kowhai, tui, demo)).toBeGreaterThan(0);

    expect(await takeDownUnlisted([TUI], days(5))).toEqual([
      { company: "kowhai", status: "unlisted", takenDown: kowhai },
    ]);
    expect(await up("kowhai")).toEqual([]);
    expect((await listAll({ companyId: "kowhai" })).every((j) => j.removedReason === "company_off")).toBe(true);
    expect((await up("tui")).length).toBe(tui);
    expect((await up("demo-kowhai")).length + (await up("demo-tui")).length).toBe(demo);
    expect(await takeDownUnlisted([TUI], days(5))).toEqual([]);
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

  it("reads Ashby's answer (#138): unlisted postings left out, New Zealand only when every address is", () => {
    const ab = parseAshby(ASHBY);
    expect(ab.map((p) => p.title)).toEqual([
      "Senior Firmware Engineer",
      "Senior Software Engineer",
      "Software Engineering Intern",
      "Account Manager",
      "Software Engineer",
      "Senior Data Engineer",
    ]);
    expect(ab[0]).toMatchObject({
      externalId: "7a1e0000-0000-4000-8000-000000000001",
      locations: ["Auckland", "New Zealand"],
      country: "NZ",
      departments: ["Hardware"],
      commitment: "FullTime",
      url: "https://jobs.ashbyhq.com/pukeko-example/7a1e0000-0000-4000-8000-000000000001",
      postedAt: "2026-10-05T21:00:00.000Z",
    });
    expect(ab[0].text).toContain("5+ years of embedded C");
    expect(ab[1].pay).toEqual({ minCents: 15_000_000, maxCents: 18_000_000, currency: "NZD", period: "year" });
    expect(ab[1].locations).toEqual(["Remote - New Zealand", "Wellington", "New Zealand"]);
    // Sydney first, Wellington as a secondary location: not New Zealand only, but Wellington is among the places.
    expect(ab[5]).not.toHaveProperty("country");
    expect(ab[5].locations).toEqual(["Sydney", "New South Wales", "Australia", "Wellington", "New Zealand"]);
    expect(() => parseAshby([])).toThrow();
    expect(postingsUrl("ashby", "partly.com")).toBe(
      "https://api.ashbyhq.com/posting-api/job-board/partly.com?includeCompensation=true",
    );
  });

  it("keeps an Ashby company's software and electrical jobs in New Zealand, like the other two", async () => {
    const PUKEKO: ExternalCompany = {
      id: "pukeko",
      name: "Pukeko Farms",
      source: "ashby",
      board: "pukeko-example",
      careersUrl: "https://jobs.ashbyhq.com/pukeko-example",
      terms: checked,
    };
    const { getJson } = feeds({ [postingsUrl("ashby", "pukeko-example")]: ASHBY });
    const [report] = await importExternalJobs({ companies: [PUKEKO], getJson, now: () => T0 });
    expect(report).toMatchObject({ company: "pukeko", status: "imported", inFeed: 6, kept: 4, added: 4 });
    const jobs = await listExternalJobs({ companyId: "pukeko" });
    expect(new Map(jobs.map((j) => [j.title, [j.field, j.kind, j.city]]))).toEqual(
      new Map([
        ["Senior Firmware Engineer", ["electrical", "full_time", "auckland"]],
        ["Senior Software Engineer", ["software", "full_time", "wellington"]],
        ["Software Engineering Intern", ["software", "internship", "christchurch"]],
        ["Senior Data Engineer", ["software", "contract", "wellington"]],
      ]),
    );
    expect(await getExternalJob("pukeko:7a1e0000-0000-4000-8000-000000000001")).toMatchObject({
      source: "ashby",
      minYears: 5,
      visa: ["work_rights"],
    });
    expect(await getExternalJob("pukeko:7a1e0000-0000-4000-8000-000000000003")).toMatchObject({
      closesAt: "2026-11-30T10:59:59.000Z",
    });
    expect(JSON.stringify(jobs)).not.toContain("must never reach the database");
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
