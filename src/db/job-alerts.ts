// 职位提醒 (#53, PRD R-29): each account's saved searches, and the new jobs they found. Matching runs on the server
// when a job goes live (published without review, or approved by a moderator). Server only.
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, jobAlertHits, jobAlerts } from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { employerNames, matchesFilter } from "@/lib/data";
import { isOpenJob } from "@/lib/job-expiry";
import type { CountryCode, Job } from "@/lib/types";
import type { ExternalSection } from "@/lib/external-jobs/filter";
import { normalizeEmail } from "@/components/seeker/session";
import { ALERT_LIMIT, alertFilter } from "@/components/seeker/job-alerts";

/** Insertion order, for alerts saved in the same millisecond. */
const inserted = sql`rowid`;

export type JobAlert = typeof jobAlerts.$inferSelect;
export type JobAlertHit = typeof jobAlertHits.$inferSelect;

/** The account's alerts, oldest first. */
export async function listJobAlerts(email: string): Promise<JobAlert[]> {
  const db = await database();
  return db
    .select()
    .from(jobAlerts)
    .where(eq(jobAlerts.email, normalizeEmail(email)))
    .orderBy(asc(jobAlerts.createdAt), inserted);
}

export type CreateAlertResult =
  { status: "created" | "exists"; alert: JobAlert } | { status: "limit" } | { status: "no_account" };

/**
 * Saves a search as an alert: of the job list, or with a `section` of 实习 or 专业职位 (#131). `query` must already be
 * in stored form (normalizeAlertQuery, normalizeExternalQuery): the same search saved twice is the alert there is. At
 * most ALERT_LIMIT per account, both kinds together.
 */
export async function createJobAlert(
  email: string,
  alert: { name: string; country: CountryCode; query: string; section?: ExternalSection },
  now = new Date(),
): Promise<CreateAlertResult> {
  const address = normalizeEmail(email);
  const db = await database();
  const section = alert.section ?? null;
  const same = and(
    eq(jobAlerts.email, address),
    eq(jobAlerts.country, alert.country),
    section ? eq(jobAlerts.section, section) : isNull(jobAlerts.section),
    eq(jobAlerts.query, alert.query),
  );
  const row: JobAlert = {
    id: randomUUID(),
    email: address,
    name: alert.name,
    country: alert.country,
    query: alert.query,
    section,
    paused: false,
    createdAt: now.toISOString(),
  };
  // One statement: the account exists, the same search is not saved yet, and the account is under the limit when the
  // row goes in, so two saves at once cannot pass the limit or save the search twice (ADR 0031).
  const created = await insertIf(
    db,
    jobAlerts,
    row,
    sql`exists (select 1 from ${accounts} where ${accounts.email} = ${address}) and not exists (select 1 from ${jobAlerts} where ${same}) and (select count(*) from ${jobAlerts} where ${jobAlerts.email} = ${address}) < ${ALERT_LIMIT}`,
  ).returning({ id: jobAlerts.id });
  if (created.length) return { status: "created", alert: row };
  // Only to say why not.
  const [account] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.email, address));
  if (!account) return { status: "no_account" };
  const [existing] = await db.select().from(jobAlerts).where(same);
  return existing ? { status: "exists", alert: existing } : { status: "limit" };
}

/** Renames, pauses or resumes one of the account's alerts. False when the account has no alert with that id. */
export async function updateJobAlert(
  email: string,
  id: string,
  patch: { name?: string; paused?: boolean },
): Promise<boolean> {
  const set = {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.paused !== undefined && { paused: patch.paused }),
  };
  const db = await database();
  const where = and(eq(jobAlerts.id, id), eq(jobAlerts.email, normalizeEmail(email)));
  const [row] = await db.select().from(jobAlerts).where(where);
  if (!row) return false;
  if (Object.keys(set).length) await db.update(jobAlerts).set(set).where(where);
  return true;
}

/** Deletes one of the account's alerts. The jobs it already found stay in the notifications. */
export async function deleteJobAlert(email: string, id: string): Promise<boolean> {
  const db = await database();
  const deleted = await db
    .delete(jobAlerts)
    .where(and(eq(jobAlerts.id, id), eq(jobAlerts.email, normalizeEmail(email))))
    .returning({ id: jobAlerts.id });
  return deleted.length > 0;
}

/**
 * A job has gone live: every account with a running alert it matches gets one notification for it, named after the
 * oldest alert that matched. An account is told about a job once, however many alerts match or however often the
 * job goes live again; never about its own business's jobs. Returns the accounts told now.
 */
export async function matchJobAlerts(job: Job, now = new Date()): Promise<string[]> {
  if (!isOpenJob(job, now.getTime())) return [];
  const db = await database();
  const running = await db
    .select()
    .from(jobAlerts)
    .where(and(eq(jobAlerts.country, job.country), isNull(jobAlerts.section), eq(jobAlerts.paused, false)))
    .orderBy(asc(jobAlerts.createdAt), inserted);
  const owners = await db
    .select({ email: accounts.email })
    .from(accounts)
    .where(eq(accounts.employerId, job.employerId));
  const skip = new Set(owners.map((o) => o.email));
  // The search looks in the business's name too (bugs-1).
  const searched = running.some((alert) => alertFilter(alert).query);
  const employerName = searched ? (await employerNames([job.employerId])).get(job.employerId) : undefined;

  const hits = new Map<string, typeof jobAlertHits.$inferInsert>();
  for (const alert of running) {
    if (skip.has(alert.email) || hits.has(alert.email) || !matchesFilter(job, alertFilter(alert), { employerName }))
      continue;
    hits.set(alert.email, { email: alert.email, jobId: job.id, alertName: alert.name, createdAt: now.toISOString() });
  }
  if (!hits.size) return [];
  const told = await db
    .insert(jobAlertHits)
    .values([...hits.values()])
    .onConflictDoNothing()
    .returning({ email: jobAlertHits.email });
  return told.map((row) => row.email);
}

/** The jobs the account's alerts found, newest first. */
export async function listJobAlertHits(email: string, limit = 50): Promise<JobAlertHit[]> {
  const db = await database();
  return db
    .select()
    .from(jobAlertHits)
    .where(eq(jobAlertHits.email, normalizeEmail(email)))
    .orderBy(desc(jobAlertHits.createdAt), desc(jobAlertHits.jobId))
    .limit(limit);
}
