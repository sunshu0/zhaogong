// Data access. Today it reads the demo data in memory; the backend will replace the bodies,
// not the signatures, so pages should only ever go through these functions.
import { MOCK_CONTACT_VIEWS, MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import type {
  Account,
  ContactView,
  CountryCode,
  Employer,
  EmployerVerification,
  Job,
  JobFilter,
  ModerationLogEntry,
  PlatformStats,
  Report,
  ReportReason,
} from "@/lib/types";

// One copy per server process. Pages and Server Functions share it, so a job published by an
// employer shows on the home page until the server restarts.
const jobs: Job[] = MOCK_JOBS.map((j) => normalizeJob({ ...j }));
const employers: Employer[] = MOCK_EMPLOYERS.map((e) => ({ ...e }));
const reports: Report[] = [];
const contactViews: ContactView[] = MOCK_CONTACT_VIEWS.map((v) => ({ ...v }));
const moderationLog: ModerationLogEntry[] = [];
const accounts = new Map<string, Account>();

/**
 * Every write goes through here, so stored jobs always have one shape: employment types as a clean
 * list (older drafts sent a single type) and an explicit contact choice (private unless chosen).
 */
function normalizeJob<T extends Partial<Job>>(job: T): T {
  if ("employmentType" in job) job.employmentType = normalizeEmploymentTypes(job.employmentType);
  if ("contactPublic" in job || !("id" in job)) job.contactPublic = job.contactPublic === true;
  return job;
}

export function matchesFilter(job: Job, f: JobFilter): boolean {
  if (job.country !== f.country || job.status !== "active") return false;
  if (f.regionIds?.length && !f.regionIds.includes(job.regionId)) return false;
  if (f.industries?.length && !f.industries.includes(job.industry)) return false;
  if (f.employmentTypes?.length && !job.employmentType.some((type) => f.employmentTypes!.includes(type))) return false;
  if (f.minPay != null && (job.pay.max ?? job.pay.min) < f.minPay) return false;
  if (f.visa && !job.visaAccepted.includes(f.visa)) return false;
  if (f.mealsIncluded && !job.mealsIncluded) return false;
  if (f.accommodationIncluded && !job.accommodationIncluded) return false;
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    const text = `${job.titleZh} ${job.titleEn} ${job.descriptionZh} ${job.descriptionEn}`.toLowerCase();
    if (q && !text.includes(q)) return false;
  }
  return true;
}

/** Newest first, urgent jobs first within the same day. */
export async function listJobs(filter: JobFilter): Promise<Job[]> {
  return jobs
    .filter((j) => matchesFilter(j, filter))
    .sort((a, b) => {
      const day = (s: string) => s.slice(0, 10);
      if (day(a.postedAt) !== day(b.postedAt)) return b.postedAt.localeCompare(a.postedAt);
      return Number(b.urgent) - Number(a.urgent);
    });
}

export async function getJob(id: string): Promise<Job | undefined> {
  return jobs.find((j) => j.id === id);
}

export async function getEmployer(id: string): Promise<Employer | undefined> {
  return employers.find((e) => e.id === id);
}

export async function listJobsByEmployer(employerId: string): Promise<Job[]> {
  return jobs.filter((j) => j.employerId === employerId);
}

export async function createJob(job: Omit<Job, "id">): Promise<Job> {
  const created = { ...normalizeJob({ ...job }), id: `j${jobs.length + 1}` };
  jobs.push(created);
  return created;
}

export async function submitReport(jobId: string, reason: ReportReason, note?: string): Promise<Report> {
  const report: Report = {
    id: `r${reports.length + 1}`,
    jobId,
    reason,
    note,
    createdAt: new Date().toISOString(),
    status: "open",
  };
  reports.push(report);
  return report;
}

export async function listReports(): Promise<Report[]> {
  return [...reports];
}

/** Every job in a market, whatever its status, newest first. For employer and moderation pages. */
export async function listAllJobs(country: CountryCode): Promise<Job[]> {
  return jobs.filter((j) => j.country === country).sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

/** Edit, close, refresh or take down a job. The id and market cannot change. */
export async function updateJob(id: string, patch: Partial<Omit<Job, "id" | "country">>): Promise<Job | undefined> {
  const job = jobs.find((j) => j.id === id);
  if (!job) return undefined;
  Object.assign(job, normalizeJob({ ...patch }));
  return job;
}

export async function updateReport(id: string, status: Report["status"]): Promise<Report | undefined> {
  const report = reports.find((r) => r.id === id);
  if (!report) return undefined;
  report.status = status;
  return report;
}

export async function listEmployers(): Promise<Employer[]> {
  return [...employers];
}

export async function setEmployerVerification(
  id: string,
  verification: EmployerVerification,
  details: { legalName?: string; businessNumber?: string } = {},
): Promise<Employer | undefined> {
  const employer = employers.find((e) => e.id === id);
  if (!employer) return undefined;
  Object.assign(employer, { verification, ...details });
  return employer;
}

/** Ban an employer and take down their live jobs (active or pending review). Returns the ids taken down. */
export async function banEmployer(id: string): Promise<string[]> {
  const employer = employers.find((e) => e.id === id);
  if (!employer) return [];
  employer.bannedAt = new Date().toISOString();
  // Only jobs that are public or waiting to be: closed jobs are not shown, so there is nothing to take down.
  const takenDown = jobs.filter((j) => j.employerId === id && (j.status === "active" || j.status === "pending_review"));
  for (const j of takenDown) j.status = "removed";
  return takenDown.map((j) => j.id);
}

/** Record that a signed-in job seeker revealed a job's contact details. */
export async function recordContactView(jobId: string, viewerEmail: string): Promise<ContactView> {
  const view: ContactView = { jobId, viewerEmail, viewedAt: new Date().toISOString() };
  contactViews.push(view);
  return view;
}

/** Contact reveals for one job, newest first. */
export async function listContactViews(jobId: string): Promise<ContactView[]> {
  return contactViews.filter((v) => v.jobId === jobId).sort((a, b) => b.viewedAt.localeCompare(a.viewedAt));
}

/** Record a moderation decision. */
export async function addModerationLog(entry: Omit<ModerationLogEntry, "id" | "at">): Promise<ModerationLogEntry> {
  const full: ModerationLogEntry = { ...entry, id: `a${moderationLog.length + 1}`, at: new Date().toISOString() };
  moderationLog.push(full);
  return full;
}

/** Moderation decisions, newest first. */
export async function listModerationLog(): Promise<ModerationLogEntry[]> {
  return [...moderationLog].reverse();
}

/** Real counts for the landing page. Taken-down jobs and banned employers are left out. */
export async function getPlatformStats(country: CountryCode): Promise<PlatformStats> {
  const banned = new Set(employers.filter((e) => e.bannedAt).map((e) => e.id));
  const posted = jobs.filter((j) => j.country === country && j.status !== "removed" && !banned.has(j.employerId));
  const ids = new Set(posted.map((j) => j.id));
  return {
    employersPosting: new Set(posted.map((j) => j.employerId)).size,
    jobsPosted: posted.length,
    hiresConfirmed: posted.reduce((sum, j) => sum + (j.hiresConfirmed ?? 0), 0),
    contactViews: contactViews.filter((v) => ids.has(v.jobId)).length,
  };
}

/** Good jobs to show off: active, from a verified and not banned employer, best pay first, then newest. */
export async function listFeaturedJobs(country: CountryCode, limit = 6): Promise<Job[]> {
  const trusted = new Set(employers.filter((e) => e.verification !== "unverified" && !e.bannedAt).map((e) => e.id));
  return jobs
    .filter((j) => j.country === country && j.status === "active" && trusted.has(j.employerId))
    .sort((a, b) => (b.pay.max ?? b.pay.min) - (a.pay.max ?? a.pay.min) || b.postedAt.localeCompare(a.postedAt))
    .slice(0, limit);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getAccount(email: string): Promise<Account | undefined> {
  return accounts.get(normalizeEmail(email));
}

/** Sign-up and sign-in both land here: the account is created on first use. */
export async function ensureAccount(email: string): Promise<Account> {
  const key = normalizeEmail(email);
  let account = accounts.get(key);
  if (!account) {
    account = { email: key, createdAt: new Date().toISOString() };
    accounts.set(key, account);
  }
  return account;
}

/** A new business an employer signs up with. Starts unverified. */
export async function createEmployer(details: { name: string; regionId: string }): Promise<Employer> {
  const employer: Employer = {
    id: `e${employers.length + 1}`,
    name: details.name.trim(),
    verification: "unverified",
    regionId: details.regionId,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  employers.push(employer);
  return employer;
}

export type OpenEmployerResult =
  | { ok: true; account: Account; employer: Employer }
  | { ok: false; reason: "no_employer" | "banned" | "taken" | "already_employer" };

/**
 * Open the employer identity of an account for one business. A business belongs to one account;
 * an account has one business. Banned businesses cannot be taken on.
 */
export async function openEmployerIdentity(email: string, employerId: string): Promise<OpenEmployerResult> {
  const account = await ensureAccount(email);
  const employer = employers.find((e) => e.id === employerId);
  if (!employer) return { ok: false, reason: "no_employer" };
  if (employer.bannedAt) return { ok: false, reason: "banned" };
  if (account.employerId && account.employerId !== employerId) return { ok: false, reason: "already_employer" };
  for (const other of accounts.values()) {
    if (other !== account && other.employerId === employerId) return { ok: false, reason: "taken" };
  }
  account.employerId = employerId;
  return { ok: true, account, employer };
}

/** The business an account posts for, if its employer identity is open and the business is not banned. */
export async function getAccountEmployer(email: string): Promise<Employer | undefined> {
  const account = accounts.get(normalizeEmail(email));
  if (!account?.employerId) return undefined;
  const employer = employers.find((e) => e.id === account.employerId);
  return employer && !employer.bannedAt ? employer : undefined;
}
