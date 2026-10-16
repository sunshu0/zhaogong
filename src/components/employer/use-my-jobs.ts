"use client";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { getMyJob, getMyJobNumbers, getMyJobRenewals, getMyJobs } from "@/app/employer/actions";
import type { JobNumbers } from "@/db/job-stats";
import type { RenewalCounts } from "@/db/job-renewals";
import { getMyApplicationCounts } from "@/app/employer/applicant-actions";
import type { ApplicationCount } from "@/db/job-applications";

type Loaded = {
  email: string;
  jobs: Job[];
  numbers: Record<string, JobNumbers>;
  renewals: RenewalCounts;
  /** Applications to each job (#84); jobs nobody applied to are left out. */
  applications: Record<string, ApplicationCount>;
  now: number;
};

/**
 * The account's jobs, their numbers (#55), renewals (#69) and applications (#84) from the server, with the time they were read; `reload`
 * after a change.
 */
export function useMyJobs(email: string | undefined) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!email) return;
    let live = true;
    Promise.all([getMyJobs(), getMyJobNumbers(), getMyJobRenewals(), getMyApplicationCounts()]).then(
      ([jobs, numbers, renewals, applications]) => {
        if (live) setLoaded({ email, jobs, numbers, renewals, applications, now: Date.now() });
      },
    );
    return () => {
      live = false;
    };
  }, [email, version]);

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
