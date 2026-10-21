// External jobs in the database (#111, ADR 0014): what each import found, kept as facts. The importer
// (src/lib/external-jobs/import.ts) and, later, the moderators' and the sections' pages call this. Server only.
import { and, asc, eq, getTableColumns, isNull, not, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { database } from "@/db/ready";
import { inList } from "@/db/in-list";
import * as t from "@/db/schema";
import { insertIf } from "@/db/write-if";
import type { ExternalCompany } from "@/config/external-companies";
import type { ExternalFacts } from "@/lib/external-jobs/types";
import { isShown, type ExternalReview } from "@/lib/external-jobs/visibility";

export type ExternalJob = typeof t.externalJobs.$inferSelect;

export interface FeedResult {
  added: number;
  updated: number;
  /** Approved jobs whose title, link or flags changed, so a moderator looks again. */
  backToReview: number;
  removed: number;
}

export const externalJobId = (companyId: string, externalId: string) => `${companyId}:${externalId}`;

/**
 * Stores what one import of a company's feed found: new jobs wait for review, known ones get the new facts and
 * today's 「信息取于」, jobs no longer in the feed come down, and so do jobs whose closing day is over.
 */
export async function saveCompanyFeed(
  company: Pick<ExternalCompany, "id" | "name" | "source">,
  found: ExternalFacts[],
  now = new Date(),
): Promise<FeedResult> {
  const db = await database();
  const at = now.toISOString();
  const jobs = t.externalJobs;
  // Read first only to count for the import's log line; what happens to each job is decided in the statements below,
  // against the rows as they are when the batch writes (ADR 0031).
  const known = new Map((await db.select().from(jobs).where(eq(jobs.companyId, company.id))).map((j) => [j.id, j]));
  const result: FeedResult = { added: 0, updated: 0, backToReview: 0, removed: 0 };
  const seen = new Set<string>();
  const columns = getTableColumns(jobs);
  const excluded = (key: keyof typeof columns) => sql.raw(`excluded."${columns[key].name}"`);
  // An approved job whose title, link or flags changed goes back to review (SQLite reads the old row on both sides).
  const changed = sql`${jobs.review} = 'approved' and (${jobs.title} is not ${excluded("title")} or ${jobs.url} is not ${excluded("url")} or ${jobs.flags} is not ${excluded("flags")})`;
  const upserts = [];
  for (const facts of found) {
    const id = externalJobId(company.id, facts.externalId);
    if (seen.has(id)) continue;
    seen.add(id);
    const closed = facts.closesAt != null && Date.parse(facts.closesAt) <= now.getTime();
    const row = {
      companyName: company.name,
      source: company.source,
      ...facts,
      lastSeenAt: at,
      removedReason: closed ? ("closed" as const) : null,
    };
    const before = known.get(id);
    if (!before) result.added += 1;
    else {
      result.updated += 1;
      const moved = before.title !== row.title || before.url !== row.url || before.flags.join() !== row.flags.join();
      if (before.review === "approved" && moved) result.backToReview += 1;
    }
    const fromFeed = Object.fromEntries(
      Object.keys(row)
        .filter((key): key is keyof typeof columns => key in columns)
        .map((key) => [key, excluded(key)]),
    );
    upserts.push(
      db
        .insert(jobs)
        .values({
          id,
          companyId: company.id,
          ...row,
          removedAt: closed ? at : null,
          firstSeenAt: at,
          review: "pending",
          reviewedAt: null,
        })
        .onConflictDoUpdate({
          target: jobs.id,
          set: {
            ...fromFeed,
            // A job past its closing day keeps the day it first came down.
            removedAt: sql`case when ${excluded("removedAt")} is null then null else coalesce(${jobs.removedAt}, ${excluded("removedAt")}) end`,
            review: sql`case when ${changed} then 'pending' else ${jobs.review} end`,
            reviewedAt: sql`case when ${changed} then null else ${jobs.reviewedAt} end`,
          },
        }),
    );
  }
  for (const job of known.values()) if (!seen.has(job.id) && job.removedAt == null) result.removed += 1;
  const statements: BatchItem<"sqlite">[] = [
    ...upserts,
    // Jobs no longer in the feed come down; the list goes in as one parameter (D1 takes at most 100).
    db
      .update(jobs)
      .set({ removedAt: at, removedReason: "gone" })
      .where(and(eq(jobs.companyId, company.id), isNull(jobs.removedAt), not(inList(jobs.id, [...seen])))),
  ];
  if (statements.length > 0) {
    await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
  return result;
}

/** Takes down every job of a company that is no longer imported. Returns how many came down. */
export async function takeDownCompany(companyId: string, now = new Date()): Promise<number> {
  const db = await database();
  const up = await db
    .select({ id: t.externalJobs.id })
    .from(t.externalJobs)
    .where(and(eq(t.externalJobs.companyId, companyId), isNull(t.externalJobs.removedAt)));
  if (up.length === 0) return 0;
  await db
    .update(t.externalJobs)
    .set({ removedAt: now.toISOString(), removedReason: "company_off" })
    .where(and(eq(t.externalJobs.companyId, companyId), isNull(t.externalJobs.removedAt)));
  return up.length;
}

/** Every external job (moderators' view), or with `shownAt` only those the sections may show then. */
export async function listExternalJobs(options: { shownAt?: Date; companyId?: string } = {}): Promise<ExternalJob[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(t.externalJobs)
    .where(options.companyId ? eq(t.externalJobs.companyId, options.companyId) : undefined)
    .orderBy(asc(t.externalJobs.companyId), asc(t.externalJobs.title), asc(t.externalJobs.id));
  const shownAt = options.shownAt?.getTime();
  return shownAt == null ? rows : rows.filter((job) => isShown(job, shownAt));
}

export async function getExternalJob(id: string): Promise<ExternalJob | undefined> {
  const db = await database();
  const [row] = await db.select().from(t.externalJobs).where(eq(t.externalJobs.id, id));
  return row;
}

/** A moderator's decision on a job (the moderators' page comes with #112). */
export async function setExternalReview(id: string, review: ExternalReview, now = new Date()): Promise<boolean> {
  const db = await database();
  const done = await db
    .update(t.externalJobs)
    .set({ review, reviewedAt: review === "pending" ? null : now.toISOString() })
    .where(eq(t.externalJobs.id, id))
    .returning({ id: t.externalJobs.id });
  return done.length > 0;
}

// ---- companies a moderator stopped (#112) ----

export type CompanyBlock = typeof t.externalCompanyBlocks.$inferSelect;

export async function listCompanyBlocks(): Promise<CompanyBlock[]> {
  const db = await database();
  return db.select().from(t.externalCompanyBlocks).orderBy(asc(t.externalCompanyBlocks.companyId));
}

/**
 * Stops importing a company and takes all its jobs down at once, in one batch. A company already stopped
 * keeps its first record, except that a takedown request replaces a plain stop (it is the stronger reason).
 * Returns how many jobs came down, or "already".
 */
export async function blockCompany(
  companyId: string,
  block: { kind: CompanyBlock["kind"]; note: string; requester?: string },
  now = new Date(),
): Promise<{ takenDown: number } | "already"> {
  const db = await database();
  const at = now.toISOString();
  const blocks = t.externalCompanyBlocks;
  const row = { companyId, kind: block.kind, note: block.note, requester: block.requester ?? null, createdAt: at };
  // A plain stop only goes in when the company has no record; a takedown also replaces a plain stop.
  const record =
    block.kind === "takedown"
      ? insertIf(
          db,
          blocks,
          row,
          sql`not exists (select 1 from ${blocks} where ${blocks.companyId} = ${companyId} and ${blocks.kind} = 'takedown')`,
        ).onConflictDoUpdate({ target: blocks.companyId, set: row })
      : insertIf(db, blocks, row, sql`not exists (select 1 from ${blocks} where ${blocks.companyId} = ${companyId})`);
  // One batch (ADR 0031): the jobs come down only if this record is the one just written.
  const [recorded, down] = await db.batch([
    record.returning({ companyId: blocks.companyId }),
    db
      .update(t.externalJobs)
      .set({ removedAt: at, removedReason: "company_off" })
      .where(
        and(
          eq(t.externalJobs.companyId, companyId),
          isNull(t.externalJobs.removedAt),
          sql`exists (select 1 from ${blocks} where ${blocks.companyId} = ${companyId} and ${blocks.kind} = ${block.kind} and ${blocks.createdAt} = ${at} and ${blocks.note} = ${block.note})`,
        ),
      )
      .returning({ id: t.externalJobs.id }),
  ]);
  return recorded.length ? { takenDown: down.length } : "already";
}

/** Lets a stopped company be imported again; its jobs return with the next import, each still needing review. */
export async function unblockCompany(companyId: string): Promise<boolean> {
  const db = await database();
  const blocks = t.externalCompanyBlocks;
  // One batch (ADR 0031): the jobs go back to review only while the record is there, then the record goes.
  const [, done] = await db.batch([
    db
      .update(t.externalJobs)
      .set({ review: "pending", reviewedAt: null })
      .where(
        and(
          eq(t.externalJobs.companyId, companyId),
          sql`exists (select 1 from ${blocks} where ${blocks.companyId} = ${companyId})`,
        ),
      ),
    db.delete(blocks).where(eq(blocks.companyId, companyId)).returning({ id: blocks.companyId }),
  ]);
  return done.length > 0;
}
