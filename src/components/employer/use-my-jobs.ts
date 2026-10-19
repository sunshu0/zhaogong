"use client";
import type { Job } from "@/lib/types";
import { getMyJob, getMyJobsOverview, type JobsOverview } from "@/app/[lang]/employer/actions";
import { useServerLoad } from "@/components/ui/use-server-load";

type Loaded = JobsOverview & { now: number };

/**
 * The account's jobs, their numbers (#55), renewals (#69), applications (#84) and, with `withPosters`, who posted them
 * (#182, #186), from the server in one ask (#188), with the time they were read; `reload` after a change, or after
 * `failed` (#246: no answer came).
 */
export function useMyJobs(email: string | undefined, { withPosters = false } = {}) {
  const { value, failed, reload } = useServerLoad<Loaded>(email ? `${email} ${withPosters}` : undefined, async () => ({
    ...(await getMyJobsOverview({ withPosters })),
    now: Date.now(),
  }));
  return { ready: value, failed, reload };
}

/**
 * One of the account's jobs from the server: `job` is undefined while loading, null when it is not the account's;
 * `failed` when no answer came (#246), asked again with `reload`.
 */
export function useMyJob(jobId: string, email: string) {
  const { value, failed, reload } = useServerLoad<Job | null>(`${email} ${jobId}`, () => getMyJob(jobId));
  return { job: value, failed, reload };
}
