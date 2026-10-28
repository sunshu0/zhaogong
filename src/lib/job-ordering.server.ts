// Server Components only: no action endpoint, shared cache, or profile/preferences returned to a client.
import { getCurrentSession } from "@/lib/auth";
import { getSeekerProfile } from "@/db/seeker-profiles";
import { hasJobPreferences, jobPreferences, recommendJobs, type JobPreferences } from "@/lib/job-recommendations";
import type { JobOrder } from "@/components/seeker/job-order-query";
import type { Job } from "@/lib/types";

export type JobOrderStatus =
  "latest" | "signed_out" | "employer" | "no_preferences" | "recommended" | "all_same" | "no_matches";

/** Who asks for Recommended: only a signed-in job seeker's three saved preferences count. */
export type JobOrderViewer =
  { kind: "signed_out" | "employer" | "no_preferences" } | { kind: "seeker"; preferences: JobPreferences };

/**
 * Reads this request's session and, for a job seeker, their saved preferences. Separate from `orderJobs` so a page
 * can read it alongside the job list (Promise.all) instead of after it.
 */
export async function jobOrderViewer(now: number): Promise<JobOrderViewer> {
  const session = await getCurrentSession(undefined, new Date(now));
  if (!session) return { kind: "signed_out" };
  if (session.activeRole !== "seeker") return { kind: "employer" };
  const own = await getSeekerProfile(session.email);
  const preferences = jobPreferences(own?.profile.resume);
  return hasJobPreferences(preferences) ? { kind: "seeker", preferences } : { kind: "no_preferences" };
}

/**
 * Orders the already-filtered list in memory. With no jobs there is nothing to order and nothing to explain (the
 * page's own "no jobs" message says why), so it reads as Latest. `viewer` is only needed for Recommended.
 */
export function orderJobs(
  jobs: Job[],
  order: JobOrder,
  viewer: JobOrderViewer | null,
): { jobs: Job[]; status: JobOrderStatus } {
  if (order === "latest" || jobs.length === 0 || !viewer) return { jobs, status: "latest" };
  if (viewer.kind !== "seeker") return { jobs, status: viewer.kind };
  const ranked = recommendJobs(jobs, viewer.preferences);
  if (!ranked.matched) return { jobs, status: "no_matches" };
  return ranked.reordered ? { jobs: ranked.jobs, status: "recommended" } : { jobs, status: "all_same" };
}
