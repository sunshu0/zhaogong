import { describe, expect, it } from "vitest";
import { filterExternalJobs, isExternalFiltered, parseExternalFilter } from "@/lib/external-jobs/filter";
import type { ExternalFacts } from "@/lib/external-jobs/types";

type Job = Pick<ExternalFacts, "title" | "field" | "kind" | "minYears" | "visa" | "city" | "pay">;
const job = (title: string, more: Partial<Job>): Job => ({
  title,
  field: "software",
  kind: null,
  minYears: null,
  visa: [],
  city: "auckland",
  pay: null,
  ...more,
});

const JOBS: Job[] = [
  job("Grad", { kind: "graduate", visa: ["work_rights"] }),
  job("Intern", { kind: "internship", field: "electrical", pay: { minCents: 3000, currency: "NZD", period: "hour" } }),
  job("Senior", { kind: "full_time", minYears: 5, city: "wellington", visa: ["no_sponsorship"] }),
  job("Mid", { kind: "contract", minYears: 2, visa: ["sponsorship"] }),
  job("Unknown kind", { field: "electrical", minYears: 3, city: "christchurch" }),
];
const titles = (jobs: Job[]) => jobs.map((j) => j.title);

describe("实习 and 专业职位 filters (#113)", () => {
  it("parses only known values for the section", () => {
    expect(parseExternalFilter({}, "professional")).toEqual({});
    expect(
      parseExternalFilter(
        { field: "software", kind: "internship", experience: "ge3", visa: "x", city: ["wellington"], paid: "1" },
        "professional",
      ),
    ).toEqual({ field: "software", experience: "ge3", city: "wellington", paid: true });
    expect(parseExternalFilter({ kind: "graduate" }, "internship")).toEqual({ kind: "graduate" });
    expect(isExternalFiltered({})).toBe(false);
  });

  it("splits the jobs into the two sections; a job that does not say its kind is in 专业职位", () => {
    expect(titles(filterExternalJobs(JOBS, "internship", {}))).toEqual(["Grad", "Intern"]);
    expect(titles(filterExternalJobs(JOBS, "professional", {}))).toEqual(["Senior", "Mid", "Unknown kind"]);
    expect(titles(filterExternalJobs(JOBS, "professional", { kind: "unstated" }))).toEqual(["Unknown kind"]);
  });

  it("filters on what the posting states, with 原文未说明 as its own choice", () => {
    expect(titles(filterExternalJobs(JOBS, "professional", { experience: "le2" }))).toEqual(["Mid"]);
    expect(titles(filterExternalJobs(JOBS, "professional", { experience: "ge3" }))).toEqual(["Senior", "Unknown kind"]);
    expect(titles(filterExternalJobs(JOBS, "internship", { experience: "unstated" }))).toEqual(["Grad", "Intern"]);
    expect(titles(filterExternalJobs(JOBS, "professional", { visa: "sponsorship" }))).toEqual(["Mid"]);
    expect(titles(filterExternalJobs(JOBS, "internship", { visa: "required" }))).toEqual(["Grad"]);
    expect(titles(filterExternalJobs(JOBS, "professional", { visa: "unstated" }))).toEqual(["Unknown kind"]);
    expect(titles(filterExternalJobs(JOBS, "internship", { field: "electrical", paid: true }))).toEqual(["Intern"]);
    expect(titles(filterExternalJobs(JOBS, "professional", { city: "wellington" }))).toEqual(["Senior"]);
  });
});
