// 收藏 for external jobs (#131, ADR 0020): one row per account and saved job of 实习 or 专业职位, as saved_jobs is for
// the job list (#52). Only the account's own Server Functions read it. Server only.
import { and, desc, eq, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, externalJobs, savedExternalJobs } from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { normalizeEmail } from "@/components/seeker/session";
import type { SavedStage } from "@/components/seeker/saved-jobs";
import { isShown } from "@/lib/external-jobs/visibility";

export type SavedExternalJobRow = typeof savedExternalJobs.$inferSelect;

/** The account's saved external jobs, newest first. */
export async function listSavedExternalJobs(email: string): Promise<SavedExternalJobRow[]> {
  const db = await database();
  return db
    .select()
    .from(savedExternalJobs)
    .where(eq(savedExternalJobs.email, normalizeEmail(email)))
    .orderBy(desc(savedExternalJobs.savedAt), desc(savedExternalJobs.externalJobId));
}

/**
 * Saves an external job the sections show now (a job waiting for review is not there to save); saving it again keeps
 * the first time and the stage.
 */
export async function saveExternalJob(
  email: string,
  externalJobId: string,
  now = new Date(),
): Promise<"saved" | "already" | "no_job" | "no_account"> {
  const address = normalizeEmail(email);
  const db = await database();
  // Whether the sections show the job depends on the time too, so that part is checked here. A moderator hiding it or
  // an import taking it down at the same moment is checked again in the statement that saves it (ADR 0031).
  const [job] = await db.select().from(externalJobs).where(eq(externalJobs.id, externalJobId));
  if (job && isShown(job, now.getTime())) {
    const saved = await insertIf(
      db,
      savedExternalJobs,
      { email: address, externalJobId, savedAt: now.toISOString() },
      sql`exists (select 1 from ${accounts} where ${accounts.email} = ${address}) and exists (select 1 from ${externalJobs} where ${externalJobs.id} = ${externalJobId} and ${externalJobs.review} = 'approved' and ${externalJobs.removedAt} is null) and not exists (select 1 from ${savedExternalJobs} where ${mine(address, externalJobId)})`,
    ).returning({ externalJobId: savedExternalJobs.externalJobId });
    if (saved.length) return "saved";
  }
  // Only to say why not.
  const [account] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.email, address));
  if (!account) return "no_account";
  const [row] = await db.select().from(savedExternalJobs).where(mine(address, externalJobId));
  return row ? "already" : "no_job";
}

/** Removes a saved external job, stage and all. */
export async function unsaveExternalJob(email: string, externalJobId: string): Promise<void> {
  const db = await database();
  await db.delete(savedExternalJobs).where(mine(normalizeEmail(email), externalJobId));
}

/** Sets the stage the account picked. False when the job is not saved. */
export async function setSavedExternalStage(
  email: string,
  externalJobId: string,
  stage: SavedStage,
  now = new Date(),
): Promise<boolean> {
  const db = await database();
  const updated = await db
    .update(savedExternalJobs)
    .set({ stage, stageSetAt: now.toISOString() })
    .where(mine(normalizeEmail(email), externalJobId))
    .returning({ id: savedExternalJobs.externalJobId });
  return updated.length > 0;
}

function mine(email: string, externalJobId: string) {
  return and(eq(savedExternalJobs.email, email), eq(savedExternalJobs.externalJobId, externalJobId));
}
