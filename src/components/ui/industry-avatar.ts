import type { Industry } from "@/lib/types";

/**
 * The three soft backgrounds of the industry avatars (#375), spread over the industries so that neighbouring cards in
 * a list rarely share one.
 */
export const INDUSTRY_TONE: Record<Industry, 1 | 2 | 3> = {
  hospitality: 1,
  retail: 2,
  beauty: 1,
  construction: 3,
  cleaning: 2,
  logistics: 3,
  driver: 1,
  office: 2,
  other: 3,
};

/**
 * The industry an employer's avatar shows when it has no photo (ADR 0036): the industry most of its jobs are in; on a
 * tie, the one of its newest job among them (jobs come newest first); with no jobs, `other`.
 */
export function employerIndustry(jobs: readonly { industry: Industry }[]): Industry {
  const counts = new Map<Industry, number>();
  for (const job of jobs) counts.set(job.industry, (counts.get(job.industry) ?? 0) + 1);
  let best: Industry = "other";
  let most = 0;
  for (const [industry, count] of counts)
    if (count > most) {
      best = industry;
      most = count;
    }
  return best;
}
