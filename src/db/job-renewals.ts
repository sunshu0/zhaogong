// 续期 (#69, PRD R-33): pushing a job's closing date back, and the record of each time it was done. Only the
// employer's own Server Functions call this. Server only.
import { asc, eq, inArray } from "drizzle-orm";
import { database } from "@/db/ready";
import { jobPatch } from "@/db/rows";
import * as t from "@/db/schema";
import { getJob } from "@/lib/data";
import type { Job } from "@/lib/types";

export type JobRenewal = Omit<typeof t.jobRenewals.$inferSelect, "id">;

/** How often each job was renewed, and when last. Jobs never renewed are left out. */
export type RenewalCounts = Record<string, { count: number; lastAt: string }>;

/**
 * Moves the job's closing date to `expiresAt` (and its status, when an ended job reopens or goes to review) and
 * records the renewal, in one transaction.
 */
export async function renewJob(
  jobId: string,
  change: { expiresAt: string; status: Job["status"]; days: number },
  now = new Date(),
): Promise<Job | undefined> {
  const db = await database();
  const renewed = await db.transaction(async (tx) => {
    const [row] = await tx.select({ expiresAt: t.jobs.expiresAt }).from(t.jobs).where(eq(t.jobs.id, jobId));
    if (!row) return false;
    await tx
      .update(t.jobs)
      .set(jobPatch({ expiresAt: change.expiresAt, status: change.status }))
      .where(eq(t.jobs.id, jobId));
    await tx.insert(t.jobRenewals).values({
      jobId,
      renewedAt: now.toISOString(),
      days: change.days,
      expiresBefore: row.expiresAt,
      expiresAfter: change.expiresAt,
    });
    return true;
  });
  return renewed ? getJob(jobId) : undefined;
}

/** Every renewal of the given jobs, oldest first (for the account's data export). */
export async function listRenewals(jobIds: string[]): Promise<JobRenewal[]> {
  if (jobIds.length === 0) return [];
  const db = await database();
  const { jobId, renewedAt, days, expiresBefore, expiresAfter } = t.jobRenewals;
  return db
    .select({ jobId, renewedAt, days, expiresBefore, expiresAfter })
    .from(t.jobRenewals)
    .where(inArray(jobId, jobIds))
    .orderBy(asc(renewedAt), asc(t.jobRenewals.id));
}

export async function renewalCounts(jobIds: string[]): Promise<RenewalCounts> {
  const counts: RenewalCounts = {};
  for (const { jobId, renewedAt } of await listRenewals(jobIds)) {
    counts[jobId] = { count: (counts[jobId]?.count ?? 0) + 1, lastAt: renewedAt };
  }
  return counts;
}
