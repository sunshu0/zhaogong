// When a job stops being open. Pure, so lists, the sitemap and tests agree (ADR 0008).
import type { Job } from "@/lib/types";

/**
 * Open: active and its closing date not reached. A job past its expiresAt counts as closed the moment it is read —
 * nothing has to run at midnight for it to leave the lists (ADR 0008); its status in the database stays as it was.
 */
export function isOpenJob(job: Job, now: number): boolean {
  return job.status === "active" && Date.parse(job.expiresAt) > now;
}
