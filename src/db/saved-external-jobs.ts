// 收藏 for external jobs (#131, ADR 0020): one row per account and saved job of 实习 or 专业职位, as saved_jobs is for
// the job list (#52). Only the account's own Server Functions read it. Server only.
import { and, desc, eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, externalJobs, savedExternalJobs } from "@/db/schema";
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
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.email, address));
    if (!account) return "no_account";
    const [row] = await tx.select().from(savedExternalJobs).where(mine(address, externalJobId));
    if (row) return "already";
    const [job] = await tx.select().from(externalJobs).where(eq(externalJobs.id, externalJobId));
    if (!job || !isShown(job, now.getTime())) return "no_job";
    await tx.insert(savedExternalJobs).values({ email: address, externalJobId, savedAt: now.toISOString() });
    return "saved";
  });
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
