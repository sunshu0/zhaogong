"use client";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { getMyJobs } from "@/app/employer/actions";

/** The employer's jobs from the server, with the time they were read; `reload` after a change. */
export function useMyJobs(employerId: string | undefined) {
  const [loaded, setLoaded] = useState<{ employerId: string; jobs: Job[]; now: number }>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!employerId) return;
    let live = true;
    getMyJobs(employerId).then((jobs) => {
      if (live) setLoaded({ employerId, jobs, now: Date.now() });
    });
    return () => {
      live = false;
    };
  }, [employerId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ready: employerId && loaded?.employerId === employerId ? loaded : undefined, reload };
}
