// 续期 (#69, PRD R-33): pushing a job's closing date back, and the record of each time it was done. Only the
// employer's own Server Functions call this. Server only.
import { asc, eq, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { jobPatch } from "@/db/rows";
import { inList } from "@/db/in-list";
import * as t from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { getJob } from "@/lib/data";
import type { Job } from "@/lib/types";

export type JobRenewal = Omit<typeof t.jobRenewals.$inferSelect, "id">;

/** How often each job was renewed, and when last. Jobs never renewed are left out. */
export type RenewalCounts = Record<string, { count: number; lastAt: string }>;

/**
 * Moves the job's closing date to `expiresAt` (and its status, when an ended job reopens or goes to review) and
 * records the renewal, in one batch.
 */
export async function renewJob(
  jobId: string,
  change: { expiresAt: string; status: Job["status"]; days: number },
  now = new Date(),
): Promise<Job | undefined> {
  const db = await database();
  // One batch: the record keeps the closing date from before the change, then the job moves; nothing when the job is
  // not there (ADR 0031).
  const [recorded] = await db.batch([
    insertIf(
      db,
      t.jobRenewals,
      {
        jobId,
        renewedAt: now.toISOString(),
        days: change.days,
        expiresBefore: sql`(select ${t.jobs.expiresAt} from ${t.jobs} where ${t.jobs.id} = ${jobId})`,
        expiresAfter: change.expiresAt,
      },
      sql`exists (select 1 from ${t.jobs} where ${t.jobs.id} = ${jobId})`,
    ).returning({ id: t.jobRenewals.id }),
    db
      .update(t.jobs)
      .set(jobPatch({ expiresAt: change.expiresAt, status: change.status }))
      .where(eq(t.jobs.id, jobId)),
  ]);
  const renewed = recorded.length > 0;
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
    .where(inList(jobId, jobIds))
    .orderBy(asc(renewedAt), asc(t.jobRenewals.id));
}

export async function renewalCounts(jobIds: string[]): Promise<RenewalCounts> {
  const counts: RenewalCounts = {};
  for (const { jobId, renewedAt } of await listRenewals(jobIds)) {
    counts[jobId] = { count: (counts[jobId]?.count ?? 0) + 1, lastAt: renewedAt };
  }
  return counts;
}
