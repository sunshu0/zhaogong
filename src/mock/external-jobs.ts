// Demo external jobs (Round 18, #112/#113): two made-up companies, so the moderators' 外部职位 tab and the
// 实习 / 专业职位 sections have something to show before any real company's terms are checked. Dated from `now`
// (refreshed today, closing weeks ahead), so they show on a freshly seeded database; after 2 days without an import
// they stop showing, like real ones. The links go to example.com.
import type { ExternalFacts, ExternalSource } from "@/lib/external-jobs/types";
import type { ExternalReview } from "@/lib/external-jobs/visibility";

const DAY = 86_400_000;

type DemoJob = Omit<ExternalFacts, "closesAt" | "postedAt" | "url"> & {
  companyId: string;
  companyName: string;
  source: ExternalSource;
  closesInDays: number | null;
  postedDaysAgo: number;
  review: ExternalReview;
};

const KOWHAI = { companyId: "demo-kowhai", companyName: "Kōwhai Robotics", source: "greenhouse" as const };
const TUI = { companyId: "demo-tui", companyName: "Tūī Software", source: "lever" as const };

const JOBS: DemoJob[] = [
  {
    ...KOWHAI,
    externalId: "4001",
    title: "Graduate Software Engineer",
    location: "Auckland, New Zealand",
    city: "auckland",
    field: "software",
    kind: "graduate",
    closesInDays: 34,
    postedDaysAgo: 16,
    minYears: null,
    degree: "bachelor",
    degreeSubjects: ["computer_science", "software_engineering"],
    visa: ["work_rights"],
    pay: null,
    flags: [],
    review: "approved",
  },
  {
    ...KOWHAI,
    externalId: "4005",
    title: "Firmware Intern (Summer 2026/27)",
    location: "Auckland, New Zealand",
    city: "auckland",
    field: "electrical",
    kind: "internship",
    closesInDays: 15,
    postedDaysAgo: 12,
    minYears: null,
    degree: "bachelor",
    degreeSubjects: ["electrical_engineering", "electronic_engineering"],
    visa: [],
    pay: { minCents: 3000, currency: "NZD", period: "hour" },
    flags: [],
    review: "approved",
  },
  {
    ...KOWHAI,
    externalId: "4006",
    title: "Power Electronics Engineer",
    location: "Christchurch, Canterbury, New Zealand",
    city: "christchurch",
    field: "electrical",
    kind: "full_time",
    closesInDays: null,
    postedDaysAgo: 20,
    minYears: 3,
    degree: "bachelor",
    degreeSubjects: ["electrical_engineering"],
    visa: ["citizen_or_resident"],
    pay: { minCents: 110_000_00, maxCents: 135_000_00, currency: "NZD", period: "year" },
    flags: [],
    review: "approved",
  },
  {
    ...KOWHAI,
    externalId: "4002",
    title: "Senior Electronics Engineer",
    location: "Christchurch, Canterbury, New Zealand",
    city: "christchurch",
    field: "electrical",
    kind: null,
    closesInDays: null,
    postedDaysAgo: 27,
    minYears: 5,
    degree: null,
    degreeSubjects: [],
    visa: [],
    pay: { minCents: 120_000_00, maxCents: 150_000_00, currency: "NZD", period: "year" },
    flags: ["other_citizenship"],
    review: "pending",
  },
  {
    ...TUI,
    externalId: "6f1d3a0e-0001",
    title: "Full Stack Developer",
    location: "Wellington",
    city: "wellington",
    field: "software",
    kind: "full_time",
    closesInDays: null,
    postedDaysAgo: 9,
    minYears: 3,
    degree: "bachelor",
    degreeSubjects: ["computer_science"],
    visa: ["no_sponsorship"],
    pay: { minCents: 100_000_00, maxCents: 120_000_00, currency: "NZD", period: "year" },
    flags: [],
    review: "approved",
  },
  {
    ...TUI,
    externalId: "6f1d3a0e-0002",
    title: "Software Engineering Intern",
    location: "Auckland, New Zealand",
    city: "auckland",
    field: "software",
    kind: "internship",
    closesInDays: 44,
    postedDaysAgo: 7,
    minYears: null,
    degree: null,
    degreeSubjects: [],
    visa: [],
    pay: null,
    flags: [],
    review: "pending",
  },
];

/** The demo rows for external_jobs, as an import on `now` would have stored them. */
export function demoExternalJobs(now: number) {
  const at = new Date(now).toISOString();
  return JOBS.map(({ closesInDays, postedDaysAgo, ...job }) => ({
    ...job,
    id: `${job.companyId}:${job.externalId}`,
    url: `https://example.com/${job.companyId}/jobs/${job.externalId}`,
    closesAt: closesInDays == null ? null : new Date(now + closesInDays * DAY).toISOString(),
    postedAt: new Date(now - postedDaysAgo * DAY).toISOString(),
    firstSeenAt: new Date(now - Math.min(postedDaysAgo, 3) * DAY).toISOString(),
    lastSeenAt: at,
    removedAt: null,
    removedReason: null,
    reviewedAt: job.review === "approved" ? at : null,
  }));
}
