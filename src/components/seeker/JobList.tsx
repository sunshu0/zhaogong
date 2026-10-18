import type { ReactNode } from "react";
import type { Employer, Job } from "@/lib/types";
import { JobCard, JobCardSkeleton } from "@/components/seeker/JobCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { uiMessages } from "@/i18n/messages/ui";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

export function JobList({
  jobs,
  employers,
  empty,
  look = "classic",
  lang = DEFAULT_LANG,
}: {
  jobs: Job[];
  employers: Map<string, Employer>;
  /** Extra content for the empty state, e.g. a link that clears the filters. */
  empty?: ReactNode;
  /** The cards' look (JobCard): "app" is the Round 19 sample. */
  look?: "classic" | "app";
  /** The page's language (Round 20): the list renders on the server and in the browser, so it is told. */
  lang?: Lang;
}) {
  const t = pick(seekerJobsMessages, lang).list;
  if (jobs.length === 0) {
    return (
      <div
        className={`px-4 py-10 text-center ${look === "app" ? "rounded-card bg-surface shadow-card" : "rounded-md border border-border bg-surface"}`}
      >
        <p className="font-medium">{t.emptyTitle}</p>
        <p className="mt-1 text-sm text-muted">{t.emptyHint}</p>
        {empty && <div className="mt-4">{empty}</div>}
      </div>
    );
  }

  // Separate blocks 12 px apart on the page background (#63).
  return (
    <ul className="space-y-3">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard job={job} employer={employers.get(job.employerId)} look={look} lang={lang} />
        </li>
      ))}
    </ul>
  );
}

export function JobListSkeleton({ look = "classic", lang = DEFAULT_LANG }: { look?: "classic" | "app"; lang?: Lang }) {
  if (look === "app")
    return (
      <div data-nojs-hide="">
        <SkeletonList label={pick(uiMessages, lang).loadingJobs} />
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
