"use client";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { getMyJobNumbers, getMyJobs } from "@/app/employer/actions";
import type { JobNumbers } from "@/db/job-stats";

type Loaded = { email: string; jobs: Job[]; numbers: Record<string, JobNumbers>; now: number };

/** The account's jobs and their numbers (#55) from the server, with the time they were read; `reload` after a change. */
export function useMyJobs(email: string | undefined) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!email) return;
    let live = true;
    Promise.all([getMyJobs(), getMyJobNumbers()]).then(([jobs, numbers]) => {
      if (live) setLoaded({ email, jobs, numbers, now: Date.now() });
    });
    return () => {
      live = false;
    };
  }, [email, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ready: email && loaded?.email === email ? loaded : undefined, reload };
}
