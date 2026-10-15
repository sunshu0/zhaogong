import type { ReactNode } from "react";
import type { Employer, Job } from "@/lib/types";
import { JobCard, JobCardSkeleton } from "@/components/seeker/JobCard";

export function JobList({
  jobs,
  employers,
  empty,
}: {
  jobs: Job[];
  employers: Map<string, Employer>;
  /** Extra content for the empty state, e.g. a link that clears the filters. */
  empty?: ReactNode;
}) {
  if (jobs.length === 0) {
    return (
      <div className="border-y border-border px-4 py-10 text-center">
        <p className="font-medium">暂时没有符合条件的职位</p>
        <p className="mt-1 text-sm text-muted">换个条件试试，或者过几天再来看看。</p>
        {empty && <div className="mt-4">{empty}</div>}
      </div>
    );
  }

  // Rows between thin lines (Round 13), no cards.
  return (
    <ul className="divide-y divide-border border-b border-border">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard job={job} employer={employers.get(job.employerId)} />
        </li>
      ))}
    </ul>
  );
}

export function JobListSkeleton() {
  return (
    <ul data-nojs-hide="" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i}>
          <JobCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
