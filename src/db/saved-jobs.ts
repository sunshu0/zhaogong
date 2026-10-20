// 收藏和进度 (#52): one row per account and saved job. Only the account's own Server Functions read it. Server only.
import { and, desc, eq, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, jobs, savedJobs } from "@/db/schema";
import { insertIf } from "@/db/write-if";
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
  // One statement: the account and the job must exist, and the job must not be saved yet, when the row goes in.
  const saved = await insertIf(
    db,
    savedJobs,
    { email: address, jobId, savedAt: now.toISOString() },
    sql`exists (select 1 from ${accounts} where ${accounts.email} = ${address}) and exists (select 1 from ${jobs} where ${jobs.id} = ${jobId}) and not exists (select 1 from ${savedJobs} where ${mine(address, jobId)})`,
  ).returning({ jobId: savedJobs.jobId });
  if (saved.length) return "saved";
  // Only to say why not.
  const [account] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.email, address));
  if (!account) return "no_account";
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId));
  return job ? "already" : "no_job";
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
