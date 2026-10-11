import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { getEmployer, listJobs } from "@/lib/data";
import type { Employer, Job } from "@/lib/types";
import { JobList, JobListSkeleton } from "@/components/seeker/JobList";
import { requestTime } from "@/components/seeker/request-time";

export default function Home() {
  return (
    <>
      <h1 className="mb-3 text-lg font-semibold">奥克兰中文工作</h1>
      <Suspense fallback={<JobListSkeleton />}>
        <Jobs />
      </Suspense>
    </>
  );
}

async function Jobs() {
  // "x 天前" depends on the current time, so the list renders per request.
  const now = await requestTime();
  const jobs = await listJobs({ country: DEFAULT_COUNTRY });
  const employers = await employersOf(jobs);
  return (
    <>
      <p className="mb-3 text-sm text-muted">共 {jobs.length} 个职位，最新发布在前</p>
      <JobList jobs={jobs} employers={employers} now={now} />
    </>
  );
}

async function employersOf(jobs: Job[]): Promise<Map<string, Employer>> {
  const ids = [...new Set(jobs.map((j) => j.employerId))];
  const found = await Promise.all(ids.map((id) => getEmployer(id)));
  return new Map(found.filter((e): e is Employer => e != null).map((e) => [e.id, e]));
}
