"use client";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { getContactViewCounts, getMyJobs } from "@/app/employer/actions";

type Loaded = { employerId: string; jobs: Job[]; views: Record<string, number>; now: number };

/** The employer's jobs and contact-view counts from the server, with the time they were read; `reload` after a change. */
export function useMyJobs(employerId: string | undefined) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!employerId) return;
    let live = true;
    Promise.all([getMyJobs(employerId), getContactViewCounts(employerId)]).then(([jobs, views]) => {
      if (live) setLoaded({ employerId, jobs, views, now: Date.now() });
    });
    return () => {
      live = false;
    };
  }, [employerId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ready: employerId && loaded?.employerId === employerId ? loaded : undefined, reload };
}
