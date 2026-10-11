// Data access. Today it reads the demo data in memory; the backend will replace the bodies,
// not the signatures, so pages should only ever go through these functions.
import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";
import type { Employer, Job, JobFilter, Report, ReportReason } from "@/lib/types";

const jobs: Job[] = [...MOCK_JOBS];
const reports: Report[] = [];

export function matchesFilter(job: Job, f: JobFilter): boolean {
  if (job.country !== f.country || job.status !== "active") return false;
  if (f.regionIds?.length && !f.regionIds.includes(job.regionId)) return false;
  if (f.industries?.length && !f.industries.includes(job.industry)) return false;
  if (f.employmentTypes?.length && !f.employmentTypes.includes(job.employmentType)) return false;
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
  return MOCK_EMPLOYERS.find((e) => e.id === id);
}

export async function listJobsByEmployer(employerId: string): Promise<Job[]> {
  return jobs.filter((j) => j.employerId === employerId);
}

export async function createJob(job: Omit<Job, "id">): Promise<Job> {
  const created = { ...job, id: `j${jobs.length + 1}` };
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
