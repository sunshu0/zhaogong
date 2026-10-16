// 职位提醒 on the 实习 and 专业职位 sections (#131, ADR 0020): the alerts are rows of job_alerts with a section; the
// external jobs they found are kept here. Matching runs when a moderator approves an external job (#112), the moment
// it shows. Server only.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { externalJobAlertHits, jobAlerts } from "@/db/schema";
import type { ExternalJob } from "@/db/external-jobs";
import { normalizeEmail } from "@/components/seeker/session";
import { externalAlertFilter } from "@/lib/external-jobs/alerts";
import { filterExternalJobs } from "@/lib/external-jobs/filter";
import { isShown, sectionOf } from "@/lib/external-jobs/visibility";

export type ExternalJobAlertHit = typeof externalJobAlertHits.$inferSelect;

/**
 * An external job now shows: every account with a running alert on its section that it matches gets one notification
 * for it, named after the oldest alert that matched. An account is told about a job once, however many alerts match
 * or however often the job is approved again. Returns the accounts told now.
 */
export async function matchExternalJobAlerts(job: ExternalJob, now = new Date()): Promise<string[]> {
  if (!isShown(job, now.getTime())) return [];
  const section = sectionOf(job.kind);
  const db = await database();
  const running = await db
    .select()
    .from(jobAlerts)
    .where(and(eq(jobAlerts.section, section), eq(jobAlerts.paused, false)))
    .orderBy(asc(jobAlerts.createdAt), sql`rowid`);

  const hits = new Map<string, typeof externalJobAlertHits.$inferInsert>();
  for (const alert of running) {
    if (hits.has(alert.email)) continue;
    if (filterExternalJobs([job], section, externalAlertFilter({ section, query: alert.query })).length === 0) continue;
    hits.set(alert.email, {
      email: alert.email,
      externalJobId: job.id,
      alertName: alert.name,
      createdAt: now.toISOString(),
    });
  }
  if (!hits.size) return [];
  const told = await db
    .insert(externalJobAlertHits)
    .values([...hits.values()])
    .onConflictDoNothing()
    .returning({ email: externalJobAlertHits.email });
  return told.map((row) => row.email);
}

/** The external jobs the account's alerts found, newest first. */
export async function listExternalJobAlertHits(email: string, limit = 50): Promise<ExternalJobAlertHit[]> {
  const db = await database();
  return db
    .select()
    .from(externalJobAlertHits)
    .where(eq(externalJobAlertHits.email, normalizeEmail(email)))
    .orderBy(desc(externalJobAlertHits.createdAt), desc(externalJobAlertHits.externalJobId))
    .limit(limit);
}
