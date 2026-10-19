// Data access, on the database (src/db: Drizzle + libSQL). Pages and Server Functions only ever go through
// these functions; their signatures and behaviour are the same as when the data lived in memory. Pay is
// stored in cents and returned in dollars (src/db/rows.ts). New records get the next id of their kind
// (j20, e9, r1 …), as the demo data has.
import { and, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "@/db/client";
import { database } from "@/db/ready";
import { fromJob, jobPatch, toAccount, toContactView, toEmployer, toJob, toLogEntry, toReport } from "@/db/rows";
import * as t from "@/db/schema";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import { isOpenJob } from "@/lib/job-expiry";
import { jobRoles } from "@/lib/job-roles";
import type { EvidenceMessage } from "@/lib/report-evidence";
import type {
  Account,
  ContactView,
  CountryCode,
  Employer,
  EmployerVerification,
  Job,
  JobFilter,
  ModerationLogEntry,
  PlatformStats,
  Report,
  ReportReason,
} from "@/lib/types";

/** Insertion order, which the in-memory lists had; ties in other orderings fall back to it too. */
const inserted = sql`rowid`;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The next id of a kind: the prefix and one more than the highest number used (j19 → j20). */
async function nextId(db: Db | Tx, table: SQLiteTable, column: SQLiteColumn, prefix: string): Promise<string> {
  const number = sql<number | null>`max(cast(substr(${column}, ${prefix.length + 1}) as integer))`;
  const [row] = await db
    .select({ n: number })
    .from(table)
    .where(sql`${column} glob ${`${prefix}[0-9]*`}`);
  return `${prefix}${(row?.n ?? 0) + 1}`;
}

/**
 * Every write goes through here, so stored jobs always have one shape: employment types as a clean
 * list (older drafts sent a single type) and an explicit contact choice (private unless chosen).
 */
function normalizeJob<T extends Partial<Job>>(job: T): T {
  if ("employmentType" in job) job.employmentType = normalizeEmploymentTypes(job.employmentType);
  if ("contactPublic" in job || !("id" in job)) job.contactPublic = job.contactPublic === true;
  return job;
}

export function matchesFilter(job: Job, f: JobFilter): boolean {
  if (job.country !== f.country || job.status !== "active") return false;
  if (f.regionIds?.length && !f.regionIds.includes(job.regionId)) return false;
  if (f.industries?.length && !f.industries.includes(job.industry)) return false;
  if (f.roles?.length && !jobRoles(job).some((id) => f.roles!.includes(id))) return false;
  if (f.employmentTypes?.length && !job.employmentType.some((type) => f.employmentTypes!.includes(type))) return false;
  if (f.minPay != null && (job.pay.max ?? job.pay.min) < f.minPay) return false;
  if (f.visa && !job.visaAccepted.includes(f.visa)) return false;
  if (f.mealsIncluded && !job.mealsIncluded) return false;
  if (f.accommodationIncluded && !job.accommodationIncluded) return false;
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    const text = `${job.titleZh} ${job.titleEn} ${job.descriptionZh} ${job.descriptionEn}`.toLowerCase();
    if (q && !text.includes(q)) return false;
  }
  return true;
}

async function selectJobs(where?: SQL): Promise<Job[]> {
  const db = await database();
  const rows = await db.select().from(t.jobs).where(where).orderBy(inserted);
  return rows.map(toJob);
}

/**
 * Open jobs at `now` (past their closing date they are left out, ADR 0008), newest first, urgent first within a day.
 * Pages pass `await requestTime()`: reading the clock here would end up in a prerendered shell (#100).
 */
export async function listJobs(filter: JobFilter, now: number): Promise<Job[]> {
  // The market and status narrow it in SQL; the rest of the filter is matchesFilter, shared with the tests.
  const jobs = await selectJobs(and(eq(t.jobs.country, filter.country), eq(t.jobs.status, "active")));
  return jobs
    .filter((j) => isOpenJob(j, now) && matchesFilter(j, filter))
    .sort((a, b) => {
      const day = (s: string) => s.slice(0, 10);
      if (day(a.postedAt) !== day(b.postedAt)) return b.postedAt.localeCompare(a.postedAt);
      return Number(b.urgent) - Number(a.urgent);
    });
}

export async function getJob(id: string): Promise<Job | undefined> {
  const [job] = await selectJobs(eq(t.jobs.id, id));
  return job;
}

export async function getEmployer(id: string): Promise<Employer | undefined> {
  const db = await database();
  const [row] = await db.select().from(t.employers).where(eq(t.employers.id, id));
  return row && toEmployer(row);
}

export async function listJobsByEmployer(employerId: string): Promise<Job[]> {
  return selectJobs(eq(t.jobs.employerId, employerId));
}

/** `postedBy`: the account that posts it (#182); demo and test jobs have none. */
export async function createJob(job: Omit<Job, "id">, postedBy?: string): Promise<Job> {
  const db = await database();
  return db.transaction(async (tx) => {
    const created = { ...normalizeJob({ ...job }), id: await nextId(tx, t.jobs, t.jobs.id, "j") };
    await tx.insert(t.jobs).values({ ...fromJob(created), postedBy: postedBy ? normalizeEmail(postedBy) : null });
    return created;
  });
}

/**
 * Saves a report, with the chat messages it carries as evidence (ADR 0027) in the same transaction. The caller has
 * checked the messages are the reporter's own (findOwnMessages); the reporter's email is kept with them only.
 */
export async function submitReport(
  jobId: string,
  reason: ReportReason,
  note?: string,
  evidence?: { reporterEmail: string; messages: readonly EvidenceMessage[] },
): Promise<Report> {
  const db = await database();
  return db.transaction(async (tx) => {
    const report: Report = {
      id: await nextId(tx, t.reports, t.reports.id, "r"),
      jobId,
      reason,
      note,
      createdAt: new Date().toISOString(),
      status: "open",
    };
    await tx.insert(t.reports).values({ ...report, note: note ?? null });
    if (evidence?.messages.length)
      await tx.insert(t.reportEvidence).values(
        evidence.messages.map((m) => ({
          reportId: report.id,
          reporterEmail: normalizeEmail(evidence.reporterEmail),
          kind: "message" as const,
          messageId: m.messageId,
          messageFrom: m.from,
          messageByName: m.byName,
          messageText: m.text,
          messageSentAt: m.sentAt,
          createdAt: report.createdAt,
        })),
      );
    return report;
  });
}

export async function listReports(): Promise<Report[]> {
  const db = await database();
  const rows = await db.select().from(t.reports).orderBy(inserted);
  return rows.map(toReport);
}

/** Every job in a market, whatever its status, newest first. For employer and moderation pages. */
export async function listAllJobs(country: CountryCode): Promise<Job[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.jobs)
    .where(eq(t.jobs.country, country))
    .orderBy(desc(t.jobs.postedAt), inserted);
  return rows.map(toJob);
}

/** Edit, close, refresh or take down a job. The id and market cannot change. */
export async function updateJob(id: string, patch: Partial<Omit<Job, "id" | "country">>): Promise<Job | undefined> {
  // The id and market never change, even if a patch carries them.
  const rest = Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "id" && key !== "country"));
  const columns = jobPatch(normalizeJob(rest as Partial<Job>));
  const db = await database();
  if (Object.keys(columns).length) await db.update(t.jobs).set(columns).where(eq(t.jobs.id, id));
  return getJob(id);
}

/** Closes (or reopens) a report. Closing records when, for the moderation numbers (#70). */
export async function updateReport(
  id: string,
  status: Report["status"],
  now = new Date(),
): Promise<Report | undefined> {
  const db = await database();
  const handledAt = status === "open" ? null : now.toISOString();
  await db.update(t.reports).set({ status, handledAt }).where(eq(t.reports.id, id));
  const [row] = await db.select().from(t.reports).where(eq(t.reports.id, id));
  return row && toReport(row);
}

export async function listEmployers(): Promise<Employer[]> {
  const db = await database();
  const rows = await db.select().from(t.employers).orderBy(inserted);
  return rows.map(toEmployer);
}

export async function setEmployerVerification(
  id: string,
  verification: EmployerVerification,
  details: { legalName?: string; businessNumber?: string } = {},
): Promise<Employer | undefined> {
  const set: Partial<typeof t.employers.$inferInsert> = { verification };
  if (details.legalName !== undefined) set.legalName = details.legalName;
  if (details.businessNumber !== undefined) set.businessNumber = details.businessNumber;
  const db = await database();
  await db.update(t.employers).set(set).where(eq(t.employers.id, id));
  return getEmployer(id);
}

/** Ban an employer and take down their live jobs (active or pending review). Returns the ids taken down. */
export async function banEmployer(id: string): Promise<string[]> {
  const db = await database();
  return db.transaction(async (tx) => {
    const [employer] = await tx.select({ id: t.employers.id }).from(t.employers).where(eq(t.employers.id, id));
    if (!employer) return [];
    await tx.update(t.employers).set({ bannedAt: new Date().toISOString() }).where(eq(t.employers.id, id));
    // Only jobs that are public or waiting to be: closed jobs are not shown, so there is nothing to take down.
    const live = await tx
      .select({ id: t.jobs.id })
      .from(t.jobs)
      .where(and(eq(t.jobs.employerId, id), inArray(t.jobs.status, ["active", "pending_review"])))
      .orderBy(inserted);
    const ids = live.map((j) => j.id);
    if (ids.length) await tx.update(t.jobs).set({ status: "removed" }).where(inArray(t.jobs.id, ids));
    return ids;
  });
}

/** Record that a signed-in job seeker revealed a job's contact details. */
export async function recordContactView(jobId: string, viewerEmail: string): Promise<ContactView> {
  const view: ContactView = { jobId, viewerEmail, viewedAt: new Date().toISOString() };
  const db = await database();
  await db.insert(t.contactViews).values(view);
  return view;
}

/** Contact reveals for one job, newest first. */
export async function listContactViews(jobId: string): Promise<ContactView[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.contactViews)
    .where(eq(t.contactViews.jobId, jobId))
    .orderBy(desc(t.contactViews.viewedAt), inserted);
  return rows.map(toContactView);
}

/** Record a moderation decision, with the moderator who made it (#60). */
export async function addModerationLog(
  entry: Omit<ModerationLogEntry, "id" | "at" | "moderator"> & { moderator: string },
): Promise<ModerationLogEntry> {
  const db = await database();
  return db.transaction(async (tx) => {
    const full: ModerationLogEntry = {
      ...entry,
      id: await nextId(tx, t.moderationLog, t.moderationLog.id, "a"),
      at: new Date().toISOString(),
    };
    await tx.insert(t.moderationLog).values(full);
    return full;
  });
}

/** Moderation decisions, newest first. */
export async function listModerationLog(): Promise<ModerationLogEntry[]> {
  const db = await database();
  const rows = await db.select().from(t.moderationLog).orderBy(desc(inserted));
  return rows.map(toLogEntry);
}

/** Real counts for the landing page. Taken-down jobs and banned employers are left out. */
export async function getPlatformStats(country: CountryCode): Promise<PlatformStats> {
  const db = await database();
  const banned = (await db.select({ id: t.employers.id }).from(t.employers).where(isNotNull(t.employers.bannedAt))).map(
    (e) => e.id,
  );
  const posted = (await selectJobs(eq(t.jobs.country, country))).filter(
    (j) => j.status !== "removed" && !banned.includes(j.employerId),
  );
  const ids = posted.map((j) => j.id);
  const [views] = ids.length
    ? await db.select({ n: count() }).from(t.contactViews).where(inArray(t.contactViews.jobId, ids))
    : [{ n: 0 }];
  return {
    employersPosting: new Set(posted.map((j) => j.employerId)).size,
    jobsPosted: posted.length,
    hiresConfirmed: posted.reduce((sum, j) => sum + (j.hiresConfirmed ?? 0), 0),
    contactViews: views.n,
  };
}

/**
 * Good jobs to show off: active, from a verified and not banned employer, best pay first, then newest. With `now`,
 * jobs closed by then are left out (ADR 0008). A snapshot prerendered at build time has no request time and leaves
 * it out (Cache Components does not allow reading the clock there).
 */
export async function listFeaturedJobs(country: CountryCode, limit = 6, now?: number): Promise<Job[]> {
  const trusted = new Set(
    (await listEmployers()).filter((e) => e.verification !== "unverified" && !e.bannedAt).map((e) => e.id),
  );
  return (await selectJobs(and(eq(t.jobs.country, country), eq(t.jobs.status, "active"))))
    .filter((j) => (now === undefined || isOpenJob(j, now)) && trusted.has(j.employerId))
    .sort((a, b) => (b.pay.max ?? b.pay.min) - (a.pay.max ?? a.pay.min) || b.postedAt.localeCompare(a.postedAt))
    .slice(0, limit);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getAccount(email: string): Promise<Account | undefined> {
  const db = await database();
  const [row] = await db
    .select()
    .from(t.accounts)
    .where(eq(t.accounts.email, normalizeEmail(email)));
  return row && toAccount(row);
}

/** Sign-up and sign-in both land here: the account is created on first use. */
export async function ensureAccount(email: string): Promise<Account> {
  const db = await database();
  await db
    .insert(t.accounts)
    .values({ email: normalizeEmail(email), createdAt: new Date().toISOString() })
    .onConflictDoNothing();
  return (await getAccount(email))!;
}

/** A new business an employer signs up with. Starts unverified. */
export async function createEmployer(details: { name: string; regionId: string }): Promise<Employer> {
  const db = await database();
  return db.transaction(async (tx) => {
    const employer: Employer = {
      id: await nextId(tx, t.employers, t.employers.id, "e"),
      name: details.name.trim(),
      verification: "unverified",
      regionId: details.regionId,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    await tx.insert(t.employers).values({ ...employer, legalName: null, businessNumber: null, bannedAt: null });
    return employer;
  });
}

export type OpenEmployerResult =
  | { ok: true; account: Account; employer: Employer }
  | { ok: false; reason: "no_employer" | "banned" | "taken" | "already_employer" };

/**
 * Open the employer identity of an account for one business, as the admin of its team. An account has one
 * business. A business someone already works for is joined only by invitation (#87, src/db/team.ts), so it is
 * `taken` here. Banned businesses cannot be taken on.
 */
export async function openEmployerIdentity(email: string, employerId: string): Promise<OpenEmployerResult> {
  const account = await ensureAccount(email);
  const employer = await getEmployer(employerId);
  if (!employer) return { ok: false, reason: "no_employer" };
  if (employer.bannedAt) return { ok: false, reason: "banned" };
  if (account.employerId && account.employerId !== employerId) return { ok: false, reason: "already_employer" };
  if (account.employerId === employerId) return { ok: true, account, employer };
  const db = await database();
  const claimed = await db.transaction(async (tx) => {
    const [owner] = await tx.select().from(t.accounts).where(eq(t.accounts.employerId, employerId)).limit(1);
    if (owner) return false;
    await tx
      .update(t.accounts)
      .set({ employerId, teamRole: "admin", teamJoinedAt: new Date().toISOString() })
      .where(and(eq(t.accounts.email, account.email), isNull(t.accounts.employerId)));
    return true;
  });
  if (!claimed) return { ok: false, reason: "taken" };
  return { ok: true, account: { ...account, employerId, teamRole: "admin" }, employer };
}

/** The businesses some account has bound (banned ones included: they stay linked to their account). */
export async function listClaimedEmployerIds(): Promise<string[]> {
  const db = await database();
  const rows = await db
    .select({ id: t.accounts.employerId })
    .from(t.accounts)
    .where(isNotNull(t.accounts.employerId))
    .orderBy(inserted);
  return rows.flatMap((r) => (r.id ? [r.id] : []));
}

/** The business an account posts for, if its employer identity is open and the business is not banned. */
export async function getAccountEmployer(email: string): Promise<Employer | undefined> {
  const account = await getAccount(email);
  if (!account?.employerId) return undefined;
  const employer = await getEmployer(account.employerId);
  return employer && !employer.bannedAt ? employer : undefined;
}
