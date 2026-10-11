import type { ReactNode } from "react";
import type { Employer, Job } from "@/lib/types";
import { JobCard } from "@/components/seeker/JobCard";

export function JobList({
  jobs,
  employers,
  now,
  empty,
}: {
  jobs: Job[];
  employers: Map<string, Employer>;
  now: number;
  /** Extra content for the empty state, e.g. a link that clears the filters. */
  empty?: ReactNode;
}) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center">
        <p className="font-medium">暂时没有符合条件的职位</p>
        <p className="mt-1 text-sm text-muted">换个条件试试，或者过几天再来看看。</p>
        {empty && <div className="mt-4">{empty}</div>}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard job={job} employer={employers.get(job.employerId)} now={now} />
        </li>
      ))}
    </ul>
  );
}

export function JobListSkeleton() {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="h-36 animate-pulse rounded-xl border border-border bg-surface" />
      ))}
    </ul>
  );
}
