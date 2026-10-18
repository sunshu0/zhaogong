"use client";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { getMyJob, getMyJobNumbers, getMyJobPosters, getMyJobRenewals, getMyJobs } from "@/app/employer/actions";
import type { JobPoster } from "@/components/employer/job-poster";
import type { JobNumbers } from "@/db/job-stats";
import type { RenewalCounts } from "@/db/job-renewals";
import { getMyApplicationCounts } from "@/app/employer/applicant-actions";
import type { ApplicationCount } from "@/db/job-applications";

const NO_POSTERS = { teamSize: 0, posters: {} };

type Loaded = {
  email: string;
  jobs: Job[];
  numbers: Record<string, JobNumbers>;
  renewals: RenewalCounts;
  /** Applications to each job (#84); jobs nobody applied to are left out. */
  applications: Record<string, ApplicationCount>;
  /** Who posted each job (#182), and how many people the team has; only when asked for. */
  posters: { teamSize: number; posters: Record<string, JobPoster> };
  now: number;
};

/**
 * The account's jobs, their numbers (#55), renewals (#69), applications (#84) and who posted them (#182) from the
 * server, with the time they were read; `reload` after a change.
 */
export function useMyJobs(email: string | undefined, { withPosters = false } = {}) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!email) return;
    let live = true;
    Promise.all([
      getMyJobs(),
      getMyJobNumbers(),
      getMyJobRenewals(),
      getMyApplicationCounts(),
      withPosters ? getMyJobPosters() : NO_POSTERS,
    ]).then(([jobs, numbers, renewals, applications, posters]) => {
      if (live) setLoaded({ email, jobs, numbers, renewals, applications, posters, now: Date.now() });
    });
    return () => {
      live = false;
    };
  }, [email, version, withPosters]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ready: email && loaded?.email === email ? loaded : undefined, reload };
}

/** One of the account's jobs from the server: undefined while loading, null when it is not the account's. */
export function useMyJob(jobId: string, email: string): Job | null | undefined {
  const [loaded, setLoaded] = useState<{ email: string; jobId: string; job: Job | null }>();

  useEffect(() => {
    let live = true;
    getMyJob(jobId).then((job) => {
      if (live) setLoaded({ email, jobId, job });
    });
    return () => {
      live = false;
    };
  }, [jobId, email]);

  return loaded?.email === email && loaded.jobId === jobId ? loaded.job : undefined;
}
