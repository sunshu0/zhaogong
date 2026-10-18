// 职位管理按职位名搜索 (#198): which of the business's jobs a search keeps. Pure.
import type { Job } from "@/lib/types";
import { normalizeTitle } from "@/components/employer/job-twins";

/** Below this many jobs a list is short enough to read: no search box. */
export const SEARCH_FROM = 4;

/** The jobs whose Chinese or English title has the query in it (spaces, full-width letters and case ignored). */
export function searchJobs<T extends Pick<Job, "titleZh" | "titleEn">>(jobs: readonly T[], query: string): T[] {
  const wanted = normalizeTitle(query);
  if (!wanted) return [...jobs];
  return jobs.filter(
    (job) => normalizeTitle(job.titleZh).includes(wanted) || normalizeTitle(job.titleEn).includes(wanted),
  );
}
