// 重复职位提醒 (#196): the business's live jobs with the same title as the one being written, so the employer can
// renew or edit that one instead of listing the same job twice. A hint only: two branches may hire under one title.
import type { Job } from "@/lib/types";
import { effectiveStatus } from "@/components/employer/job-status";

/** A title as people would read it the same: no spaces, full-width as half-width, case ignored. */
export function normalizeTitle(title: string): string {
  return title.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

type TwinJob = Pick<Job, "id" | "titleZh" | "status" | "expiresAt">;

/** Jobs still open to job seekers or waiting for review whose title reads the same; empty for an empty title. */
export function liveTwins<T extends TwinJob>(jobs: readonly T[], titleZh: string, now: number): T[] {
  const wanted = normalizeTitle(titleZh);
  if (!wanted) return [];
  return jobs.filter((job) => {
    const status = effectiveStatus(job, now);
    return (status === "active" || status === "pending_review") && normalizeTitle(job.titleZh) === wanted;
  });
}
