import { parseResume } from "@/lib/candidate-matching";
import { jobRoles } from "@/lib/job-roles";
import type { JobRoleId } from "@/config/job-roles";
import type { Job } from "@/lib/types";

/** Only explicit preferences; neither public visibility nor inferred skills affect your own job list. */
export interface JobPreferences {
  roles: readonly JobRoleId[];
  regionIds: readonly string[];
  expectedMinPay?: number;
}

export function jobPreferences(resume: unknown): JobPreferences {
  const input = resume && typeof resume === "object" ? (resume as Record<string, unknown>) : {};
  const parsed = parseResume({ roles: input.roles, regionIds: input.regionIds, expectedMinPay: input.expectedMinPay });
  return { roles: parsed.roles ?? [], regionIds: parsed.regionIds, expectedMinPay: parsed.expectedMinPay };
}

export function hasJobPreferences(preferences: JobPreferences): boolean {
  return preferences.roles.length > 0 || preferences.regionIds.length > 0 || preferences.expectedMinPay !== undefined;
}

/**
 * Input has already passed listJobs' hard filters, bans and expiry. Never adds or removes a job. `matched`: some job
 * meets a preference; `reordered`: the jobs do not all meet the same number of them, so the order can differ from
 * the latest (when every job scores the same, as with an expected pay of 0, the list is the latest order).
 */
export function recommendJobs(
  jobs: readonly Job[],
  preferences: JobPreferences,
): { jobs: Job[]; matched: boolean; reordered: boolean } {
  const ranked = jobs.map((job, index) => {
    const role = jobRoles(job).some((id) => preferences.roles.includes(id));
    const region = preferences.regionIds.includes(job.regionId);
    // A pay range can include the expectation; its upper bound is not a promised starting rate.
    const pay = preferences.expectedMinPay !== undefined && (job.pay.max ?? job.pay.min) >= preferences.expectedMinPay;
    return { job, index, matches: Number(role) + Number(region) + Number(pay) };
  });
  return {
    jobs: ranked.sort((a, b) => b.matches - a.matches || a.index - b.index).map(({ job }) => job),
    matched: ranked.some(({ matches }) => matches > 0),
    reordered: new Set(ranked.map(({ matches }) => matches)).size > 1,
  };
}
