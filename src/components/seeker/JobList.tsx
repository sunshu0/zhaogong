import type { ReactNode } from "react";
import type { Employer, Job } from "@/lib/types";
import { JobCard, JobCardSkeleton } from "@/components/seeker/JobCard";
import { SkeletonList } from "@/components/ui/Skeleton";

export function JobList({
  jobs,
  employers,
  empty,
  look = "classic",
}: {
  jobs: Job[];
  employers: Map<string, Employer>;
  /** Extra content for the empty state, e.g. a link that clears the filters. */
  empty?: ReactNode;
  /** The cards' look (JobCard): "app" is the Round 19 sample. */
  look?: "classic" | "app";
}) {
  if (jobs.length === 0) {
    return (
      <div
        className={`px-4 py-10 text-center ${look === "app" ? "rounded-card bg-surface shadow-card" : "rounded-md border border-border bg-surface"}`}
      >
        <p className="font-medium">暂时没有符合条件的职位</p>
        <p className="mt-1 text-sm text-muted">换个条件试试，或者过几天再来看看。</p>
        {empty && <div className="mt-4">{empty}</div>}
      </div>
    );
  }

  // Separate blocks 12 px apart on the page background (#63).
  return (
    <ul className="space-y-3">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard job={job} employer={employers.get(job.employerId)} look={look} />
        </li>
      ))}
    </ul>
  );
}

export function JobListSkeleton({ look = "classic" }: { look?: "classic" | "app" }) {
  if (look === "app")
    return (
      <div data-nojs-hide="">
        <SkeletonList label="正在加载职位" />
      </div>
    );
  return (
    <ul data-nojs-hide="" aria-hidden="true" className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <li key={i}>
          <JobCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
