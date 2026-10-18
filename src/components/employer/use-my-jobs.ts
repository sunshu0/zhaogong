"use client";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { getMyJob, getMyJobsOverview, type JobsOverview } from "@/app/employer/actions";

type Loaded = JobsOverview & { email: string; now: number };

/**
 * The account's jobs, their numbers (#55), renewals (#69), applications (#84) and, with `withPosters`, who posted them
 * (#182, #186), from the server in one ask (#188), with the time they were read; `reload` after a change.
 */
export function useMyJobs(email: string | undefined, { withPosters = false } = {}) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!email) return;
    let live = true;
    getMyJobsOverview({ withPosters }).then((overview) => {
      if (live) setLoaded({ ...overview, email, now: Date.now() });
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
