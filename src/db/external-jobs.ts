// External jobs in the database (#111, ADR 0014): what each import found, kept as facts. The importer
// (src/lib/external-jobs/import.ts) and, later, the moderators' and the sections' pages call this. Server only.
import { and, asc, eq, isNull } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
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
  return db.transaction(async (tx) => {
    const known = new Map(
      (await tx.select().from(t.externalJobs).where(eq(t.externalJobs.companyId, company.id))).map((j) => [j.id, j]),
    );
    const result: FeedResult = { added: 0, updated: 0, backToReview: 0, removed: 0 };
    const seen = new Set<string>();
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
        removedAt: closed ? at : null,
        removedReason: closed ? ("closed" as const) : null,
      };
      const before = known.get(id);
      if (!before) {
        await tx
          .insert(t.externalJobs)
          .values({ id, companyId: company.id, ...row, firstSeenAt: at, review: "pending", reviewedAt: null });
        result.added += 1;
        continue;
      }
      const changed = before.title !== row.title || before.url !== row.url || before.flags.join() !== row.flags.join();
      const review = before.review === "approved" && changed ? "pending" : before.review;
      if (review !== before.review) result.backToReview += 1;
      await tx
        .update(t.externalJobs)
        .set({
          ...row,
          removedAt: closed ? (before.removedAt ?? at) : null,
          review,
          ...(review !== before.review && { reviewedAt: null }),
        })
        .where(eq(t.externalJobs.id, id));
      result.updated += 1;
    }
    for (const job of known.values()) {
      if (seen.has(job.id) || job.removedAt != null) continue;
      await tx
        .update(t.externalJobs)
        .set({ removedAt: at, removedReason: "gone" })
        .where(eq(t.externalJobs.id, job.id));
      result.removed += 1;
    }
    return result;
  });
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
