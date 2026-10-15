// 收藏和进度 (#52): one row per account and saved job. Only the account's own Server Functions read it. Server only.
import { and, desc, eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, jobs, savedJobs } from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import type { SavedStage } from "@/components/seeker/saved-jobs";

export type SavedJobRow = typeof savedJobs.$inferSelect;

/** The account's saved jobs, newest first. */
export async function listSavedJobs(email: string): Promise<SavedJobRow[]> {
  const db = await database();
  return db
    .select()
    .from(savedJobs)
    .where(eq(savedJobs.email, normalizeEmail(email)))
    .orderBy(desc(savedJobs.savedAt), desc(savedJobs.jobId));
}

/** Saves a job; saving it again keeps the first time and the stage. */
export async function saveJob(
  email: string,
  jobId: string,
  now = new Date(),
): Promise<"saved" | "already" | "no_job" | "no_account"> {
  const address = normalizeEmail(email);
  const db = await database();
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.email, address));
    if (!account) return "no_account";
    const [job] = await tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId));
    if (!job) return "no_job";
    const [row] = await tx.select().from(savedJobs).where(mine(address, jobId));
    if (row) return "already";
    await tx.insert(savedJobs).values({ email: address, jobId, savedAt: now.toISOString() });
    return "saved";
  });
}

/** Removes a saved job, stage and all. */
export async function unsaveJob(email: string, jobId: string): Promise<void> {
  const db = await database();
  await db.delete(savedJobs).where(mine(normalizeEmail(email), jobId));
}

/** Sets the stage the account picked. False when the job is not saved. */
export async function setSavedStage(
  email: string,
  jobId: string,
  stage: SavedStage,
  now = new Date(),
): Promise<boolean> {
  const db = await database();
  const updated = await db
    .update(savedJobs)
    .set({ stage, stageSetAt: now.toISOString() })
    .where(mine(normalizeEmail(email), jobId))
    .returning({ jobId: savedJobs.jobId });
  return updated.length > 0;
}

function mine(email: string, jobId: string) {
  return and(eq(savedJobs.email, email), eq(savedJobs.jobId, jobId));
}
