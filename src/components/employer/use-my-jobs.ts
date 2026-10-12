"use client";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";
import { getContactViewCounts, getMyJobs } from "@/app/employer/actions";

type Loaded = { email: string; jobs: Job[]; views: Record<string, number>; now: number };

/** The account's jobs and contact-view counts from the server, with the time they were read; `reload` after a change. */
export function useMyJobs(email: string | undefined) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!email) return;
    let live = true;
    Promise.all([getMyJobs(email), getContactViewCounts(email)]).then(([jobs, views]) => {
      if (live) setLoaded({ email, jobs, views, now: Date.now() });
    });
    return () => {
      live = false;
    };
  }, [email, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ready: email && loaded?.email === email ? loaded : undefined, reload };
}
